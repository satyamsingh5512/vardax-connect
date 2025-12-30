// vardax-ddos/l4-filter/xdp_filter.c
// VardaX L3/L4 DDoS Protection - XDP/eBPF Fast Packet Filter
// Compile: clang -O2 -target bpf -c xdp_filter.c -o xdp_filter.o
// Load: ip link set dev eth0 xdp obj xdp_filter.o sec xdp_filter

#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/ipv6.h>
#include <linux/tcp.h>
#include <linux/udp.h>
#include <linux/icmp.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>

// Configuration constants
#define MAX_BLOCKED_IPS 100000
#define MAX_RATE_ENTRIES 1000000
#define RATE_WINDOW_NS 1000000000  // 1 second in nanoseconds
#define SYN_RATE_LIMIT 100         // SYN packets per second per IP
#define UDP_RATE_LIMIT 1000        // UDP packets per second per IP
#define ICMP_RATE_LIMIT 10         // ICMP packets per second per IP

// Packet counters for metrics
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, 8);
    __type(key, __u32);
    __type(value, __u64);
} pkt_counters SEC(".maps");

enum counter_idx {
    CNT_TOTAL = 0,
    CNT_PASSED = 1,
    CNT_DROPPED_BLOCKLIST = 2,
    CNT_DROPPED_RATE = 3,
    CNT_DROPPED_INVALID = 4,
    CNT_DROPPED_SYN_FLOOD = 5,
    CNT_DROPPED_UDP_FLOOD = 6,
    CNT_CHALLENGED = 7,
};

// IP blocklist (populated from userspace)
struct {
    __uint(type, BPF_MAP_TYPE_LRU_HASH);
    __uint(max_entries, MAX_BLOCKED_IPS);
    __type(key, __u32);      // IPv4 address
    __type(value, __u64);    // Block expiry timestamp (0 = permanent)
} ip_blocklist SEC(".maps");

// IPv6 blocklist
struct {
    __uint(type, BPF_MAP_TYPE_LRU_HASH);
    __uint(max_entries, MAX_BLOCKED_IPS);
    __type(key, struct in6_addr);
    __type(value, __u64);
} ip6_blocklist SEC(".maps");

// Rate limiting state per IP
struct rate_state {
    __u64 last_window;
    __u32 syn_count;
    __u32 udp_count;
    __u32 icmp_count;
    __u32 total_count;
};

struct {
    __uint(type, BPF_MAP_TYPE_LRU_HASH);
    __uint(max_entries, MAX_RATE_ENTRIES);
    __type(key, __u32);
    __type(value, struct rate_state);
} rate_limit_state SEC(".maps");

// Allowlist for trusted IPs (monitoring, health checks)
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1000);
    __type(key, __u32);
    __type(value, __u8);
} ip_allowlist SEC(".maps");

// Configuration (can be updated from userspace)
struct config {
    __u32 syn_rate_limit;
    __u32 udp_rate_limit;
    __u32 icmp_rate_limit;
    __u32 total_rate_limit;
    __u8 enabled;
    __u8 log_drops;
};

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 1);
    __type(key, __u32);
    __type(value, struct config);
} xdp_config SEC(".maps");

// Ring buffer for logging dropped packets (for analysis)
struct drop_event {
    __u32 src_ip;
    __u32 dst_ip;
    __u16 src_port;
    __u16 dst_port;
    __u8 protocol;
    __u8 reason;
    __u64 timestamp;
};

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024);
} drop_events SEC(".maps");

// Helper to increment counter
static __always_inline void inc_counter(__u32 idx) {
    __u64 *cnt = bpf_map_lookup_elem(&pkt_counters, &idx);
    if (cnt)
        __sync_fetch_and_add(cnt, 1);
}

// Helper to log drop event
static __always_inline void log_drop(__u32 src_ip, __u32 dst_ip, 
                                      __u16 src_port, __u16 dst_port,
                                      __u8 protocol, __u8 reason) {
    struct drop_event *evt;
    evt = bpf_ringbuf_reserve(&drop_events, sizeof(*evt), 0);
    if (!evt)
        return;
    
    evt->src_ip = src_ip;
    evt->dst_ip = dst_ip;
    evt->src_port = src_port;
    evt->dst_port = dst_port;
    evt->protocol = protocol;
    evt->reason = reason;
    evt->timestamp = bpf_ktime_get_ns();
    
    bpf_ringbuf_submit(evt, 0);
}

// Check if IP is in blocklist
static __always_inline int is_blocked_ipv4(__u32 ip) {
    __u64 *expiry = bpf_map_lookup_elem(&ip_blocklist, &ip);
    if (!expiry)
        return 0;
    
    // Check if block has expired
    if (*expiry != 0 && *expiry < bpf_ktime_get_ns())
        return 0;
    
    return 1;
}

// Check if IP is in allowlist
static __always_inline int is_allowed_ipv4(__u32 ip) {
    return bpf_map_lookup_elem(&ip_allowlist, &ip) != NULL;
}

// Rate limiting check
static __always_inline int check_rate_limit(__u32 ip, __u8 protocol, __u8 tcp_flags) {
    __u64 now = bpf_ktime_get_ns();
    __u64 window = now / RATE_WINDOW_NS;
    
    struct rate_state *state = bpf_map_lookup_elem(&rate_limit_state, &ip);
    struct rate_state new_state = {0};
    
    if (state) {
        if (state->last_window == window) {
            // Same window, increment counters
            new_state = *state;
        } else {
            // New window, reset counters
            new_state.last_window = window;
        }
    } else {
        new_state.last_window = window;
    }
    
    // Get config
    __u32 cfg_key = 0;
    struct config *cfg = bpf_map_lookup_elem(&xdp_config, &cfg_key);
    __u32 syn_limit = cfg ? cfg->syn_rate_limit : SYN_RATE_LIMIT;
    __u32 udp_limit = cfg ? cfg->udp_rate_limit : UDP_RATE_LIMIT;
    __u32 icmp_limit = cfg ? cfg->icmp_rate_limit : ICMP_RATE_LIMIT;
    
    int drop = 0;
    
    // Check protocol-specific limits
    if (protocol == IPPROTO_TCP && (tcp_flags & 0x02)) {  // SYN flag
        new_state.syn_count++;
        if (new_state.syn_count > syn_limit)
            drop = 1;
    } else if (protocol == IPPROTO_UDP) {
        new_state.udp_count++;
        if (new_state.udp_count > udp_limit)
            drop = 1;
    } else if (protocol == IPPROTO_ICMP) {
        new_state.icmp_count++;
        if (new_state.icmp_count > icmp_limit)
            drop = 1;
    }
    
    new_state.total_count++;
    
    // Update state
    bpf_map_update_elem(&rate_limit_state, &ip, &new_state, BPF_ANY);
    
    return drop;
}

// Validate TCP flags (detect invalid combinations)
static __always_inline int is_invalid_tcp_flags(__u8 flags) {
    // Invalid: SYN+FIN, SYN+RST, FIN+RST, all flags set, no flags set
    if ((flags & 0x03) == 0x03)  // SYN+FIN
        return 1;
    if ((flags & 0x06) == 0x06)  // SYN+RST
        return 1;
    if ((flags & 0x05) == 0x05)  // FIN+RST
        return 1;
    if ((flags & 0x3F) == 0x3F)  // All flags (XMAS scan)
        return 1;
    if ((flags & 0x3F) == 0x00)  // No flags (NULL scan)
        return 1;
    return 0;
}

SEC("xdp_filter")
int xdp_ddos_filter(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;
    
    inc_counter(CNT_TOTAL);
    
    // Check if filtering is enabled
    __u32 cfg_key = 0;
    struct config *cfg = bpf_map_lookup_elem(&xdp_config, &cfg_key);
    if (cfg && !cfg->enabled)
        return XDP_PASS;
    
    // Parse Ethernet header
    struct ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end)
        return XDP_PASS;
    
    __u32 src_ip = 0;
    __u32 dst_ip = 0;
    __u8 protocol = 0;
    void *l4_header = NULL;
    
    // Handle IPv4
    if (eth->h_proto == bpf_htons(ETH_P_IP)) {
        struct iphdr *ip = (void *)(eth + 1);
        if ((void *)(ip + 1) > data_end)
            return XDP_PASS;
        
        src_ip = ip->saddr;
        dst_ip = ip->daddr;
        protocol = ip->protocol;
        l4_header = (void *)ip + (ip->ihl * 4);
        
        // Check allowlist first
        if (is_allowed_ipv4(src_ip)) {
            inc_counter(CNT_PASSED);
            return XDP_PASS;
        }
        
        // Check blocklist
        if (is_blocked_ipv4(src_ip)) {
            inc_counter(CNT_DROPPED_BLOCKLIST);
            if (cfg && cfg->log_drops)
                log_drop(src_ip, dst_ip, 0, 0, protocol, CNT_DROPPED_BLOCKLIST);
            return XDP_DROP;
        }
    }
    // Handle IPv6
    else if (eth->h_proto == bpf_htons(ETH_P_IPV6)) {
        struct ipv6hdr *ip6 = (void *)(eth + 1);
        if ((void *)(ip6 + 1) > data_end)
            return XDP_PASS;
        
        // Check IPv6 blocklist
        __u64 *expiry = bpf_map_lookup_elem(&ip6_blocklist, &ip6->saddr);
        if (expiry && (*expiry == 0 || *expiry >= bpf_ktime_get_ns())) {
            inc_counter(CNT_DROPPED_BLOCKLIST);
            return XDP_DROP;
        }
        
        protocol = ip6->nexthdr;
        l4_header = (void *)(ip6 + 1);
        
        // For IPv6, we'll pass through for now (simplified)
        inc_counter(CNT_PASSED);
        return XDP_PASS;
    }
    else {
        // Non-IP traffic, pass through
        inc_counter(CNT_PASSED);
        return XDP_PASS;
    }
    
    // L4 processing
    __u16 src_port = 0;
    __u16 dst_port = 0;
    __u8 tcp_flags = 0;
    
    if (protocol == IPPROTO_TCP) {
        struct tcphdr *tcp = l4_header;
        if ((void *)(tcp + 1) > data_end) {
            inc_counter(CNT_PASSED);
            return XDP_PASS;
        }
        
        src_port = bpf_ntohs(tcp->source);
        dst_port = bpf_ntohs(tcp->dest);
        tcp_flags = (((__u8 *)tcp)[13]);
        
        // Check for invalid TCP flags
        if (is_invalid_tcp_flags(tcp_flags)) {
            inc_counter(CNT_DROPPED_INVALID);
            if (cfg && cfg->log_drops)
                log_drop(src_ip, dst_ip, src_port, dst_port, protocol, CNT_DROPPED_INVALID);
            return XDP_DROP;
        }
        
        // Rate limit SYN packets
        if (tcp_flags & 0x02) {  // SYN flag
            if (check_rate_limit(src_ip, protocol, tcp_flags)) {
                inc_counter(CNT_DROPPED_SYN_FLOOD);
                if (cfg && cfg->log_drops)
                    log_drop(src_ip, dst_ip, src_port, dst_port, protocol, CNT_DROPPED_SYN_FLOOD);
                return XDP_DROP;
            }
        }
    }
    else if (protocol == IPPROTO_UDP) {
        struct udphdr *udp = l4_header;
        if ((void *)(udp + 1) > data_end) {
            inc_counter(CNT_PASSED);
            return XDP_PASS;
        }
        
        src_port = bpf_ntohs(udp->source);
        dst_port = bpf_ntohs(udp->dest);
        
        // Rate limit UDP
        if (check_rate_limit(src_ip, protocol, 0)) {
            inc_counter(CNT_DROPPED_UDP_FLOOD);
            if (cfg && cfg->log_drops)
                log_drop(src_ip, dst_ip, src_port, dst_port, protocol, CNT_DROPPED_UDP_FLOOD);
            return XDP_DROP;
        }
    }
    else if (protocol == IPPROTO_ICMP) {
        // Rate limit ICMP
        if (check_rate_limit(src_ip, protocol, 0)) {
            inc_counter(CNT_DROPPED_RATE);
            return XDP_DROP;
        }
    }
    
    inc_counter(CNT_PASSED);
    return XDP_PASS;
}

char _license[] SEC("license") = "GPL";
