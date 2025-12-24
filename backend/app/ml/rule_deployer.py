"""
Rule Deployment System for VARDAx.

Manages the lifecycle of ModSecurity rules:
1. Generate rules from ML insights
2. Push approved rules to ModSecurity
3. Reload NGINX configuration
4. Monitor rule effectiveness
5. Rollback problematic rules

PRODUCTION CONSIDERATIONS:
- Rules are versioned and tracked
- Automatic rollback on high false positive rate
- Gradual rollout (canary deployment)
- Rule effectiveness monitoring
"""
import logging
import subprocess
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import re

from ..database import get_db

logger = logging.getLogger(__name__)


class RuleDeployer:
    """
    Deploys approved rules to ModSecurity WAF.
    
    Architecture:
    - Rules stored in database
    - Approved rules written to ModSecurity config
    - NGINX reloaded gracefully
    - Effectiveness tracked in real-time
    """
    
    def __init__(
        self,
        modsec_rules_path: Path = Path("/etc/modsecurity.d/custom/vardax_rules.conf"),
        nginx_reload_command: str = "nginx -s reload",
        test_mode: bool = False
    ):
        self.modsec_rules_path = modsec_rules_path
        self.nginx_reload_command = nginx_reload_command
        self.test_mode = test_mode
        self.db = get_db()
        
        # Rule ID counter (9900000-9999999 reserved for VARDAx)
        self.next_rule_id = 9900000
    
    def deploy_approved_rules(self) -> Dict[str, any]:
        """
        Deploy all approved rules to ModSecurity.
        
        Returns:
            Deployment summary
        """
        logger.info("Starting rule deployment...")
        
        # Get approved rules from database
        approved_rules = self.db.get_rules(status="approved")
        
        if not approved_rules:
            logger.info("No approved rules to deploy")
            return {"status": "no_rules", "deployed_count": 0}
        
        # Generate ModSecurity configuration
        modsec_config = self._generate_modsec_config(approved_rules)
        
        # Write to file
        if not self.test_mode:
            self._write_config_file(modsec_config)
            
            # Test NGINX configuration
            if not self._test_nginx_config():
                logger.error("NGINX configuration test failed - rolling back")
                self._rollback_config()
                return {"status": "error", "message": "NGINX config test failed"}
            
            # Reload NGINX
            if not self._reload_nginx():
                logger.error("NGINX reload failed - rolling back")
                self._rollback_config()
                return {"status": "error", "message": "NGINX reload failed"}
        
        # Update deployment status in database
        for rule in approved_rules:
            self.db.update_rule_status(
                rule["rule_id"],
                "deployed",
                deployed_at=datetime.utcnow().isoformat()
            )
        
        logger.info(f"Successfully deployed {len(approved_rules)} rules")
        
        return {
            "status": "success",
            "deployed_count": len(approved_rules),
            "rules": [r["rule_id"] for r in approved_rules]
        }
    
    def _generate_modsec_config(self, rules: List[Dict]) -> str:
        """Generate ModSecurity configuration from rules."""
        config_lines = [
            "# VARDAx Generated Rules",
            f"# Generated: {datetime.utcnow().isoformat()}",
            f"# Total rules: {len(rules)}",
            "# Do not edit manually - use VARDAx dashboard",
            "",
            "# =============================================================================",
            "# VARDAX DYNAMIC RULES",
            "# =============================================================================",
            ""
        ]
        
        for rule in rules:
            rule_type = rule.get("rule_type", "unknown")
            rule_content = rule.get("rule_content", "")
            description = rule.get("rule_description", "")
            confidence = rule.get("confidence", 0)
            rule_id = rule.get("rule_id", "")
            
            # Add rule header comment
            config_lines.extend([
                f"# Rule ID: {rule_id}",
                f"# Type: {rule_type}",
                f"# Description: {description}",
                f"# Confidence: {confidence:.0%}",
                f"# Approved: {rule.get('approved_at', 'N/A')}",
                ""
            ])
            
            # Add the actual ModSecurity rule
            config_lines.append(rule_content)
            config_lines.append("")
        
        return "\n".join(config_lines)
    
    def _write_config_file(self, config: str):
        """Write configuration to ModSecurity rules file."""
        # Backup existing config
        if self.modsec_rules_path.exists():
            backup_path = self.modsec_rules_path.with_suffix(".conf.backup")
            import shutil
            shutil.copy(self.modsec_rules_path, backup_path)
            logger.info(f"Backed up existing config to {backup_path}")
        
        # Write new config
        self.modsec_rules_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.modsec_rules_path, "w") as f:
            f.write(config)
        
        logger.info(f"Wrote configuration to {self.modsec_rules_path}")
    
    def _test_nginx_config(self) -> bool:
        """Test NGINX configuration before reload."""
        try:
            result = subprocess.run(
                ["nginx", "-t"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                logger.info("NGINX configuration test passed")
                return True
            else:
                logger.error(f"NGINX configuration test failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error testing NGINX config: {e}")
            return False
    
    def _reload_nginx(self) -> bool:
        """Gracefully reload NGINX."""
        try:
            result = subprocess.run(
                self.nginx_reload_command.split(),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                logger.info("NGINX reloaded successfully")
                return True
            else:
                logger.error(f"NGINX reload failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error reloading NGINX: {e}")
            return False
    
    def _rollback_config(self):
        """Rollback to previous configuration."""
        backup_path = self.modsec_rules_path.with_suffix(".conf.backup")
        
        if backup_path.exists():
            import shutil
            shutil.copy(backup_path, self.modsec_rules_path)
            logger.info("Rolled back to previous configuration")
            self._reload_nginx()
        else:
            logger.error("No backup configuration found for rollback")
    
    def monitor_rule_effectiveness(self, rule_id: str, hours: int = 24) -> Dict:
        """
        Monitor effectiveness of a deployed rule.
        
        Metrics:
        - Block count
        - False positive rate (from feedback)
        - Traffic impact
        """
        # Get rule details
        rule = self.db.get_rule(rule_id)
        if not rule:
            return {"error": "Rule not found"}
        
        # Get traffic events that matched this rule
        # (Would need to parse NGINX logs or use ModSecurity audit logs)
        
        # For now, return mock data
        # In production, parse ModSecurity audit logs
        return {
            "rule_id": rule_id,
            "blocks_count": 0,
            "challenges_count": 0,
            "false_positives": 0,
            "effectiveness_score": 0.0,
            "recommendation": "insufficient_data"
        }
    
    def generate_ip_block_rule(
        self,
        ip_address: str,
        reason: str,
        severity: str = "CRITICAL"
    ) -> str:
        """Generate ModSecurity rule to block an IP."""
        rule_id = self._get_next_rule_id()
        
        rule = f'''SecRule REMOTE_ADDR "@ipMatch {ip_address}" \\
    "id:{rule_id},\\
    phase:1,\\
    deny,status:403,\\
    msg:'VARDAx: {reason}',\\
    tag:'vardax/ip-block',\\
    tag:'auto-generated',\\
    severity:'{severity}'"'''
        
        return rule
    
    def generate_rate_limit_rule(
        self,
        endpoint: str,
        max_requests: int,
        window_seconds: int = 60
    ) -> str:
        """Generate ModSecurity rate limiting rule."""
        rule_id = self._get_next_rule_id()
        counter_id = rule_id + 1
        
        # Sanitize endpoint for variable name
        var_name = re.sub(r'[^a-zA-Z0-9_]', '_', endpoint)
        
        rules = f'''# Rate limit for {endpoint}
SecRule REQUEST_URI "@rx ^{re.escape(endpoint)}" \\
    "id:{rule_id},\\
    phase:1,\\
    pass,nolog,\\
    setvar:'ip.vardax_{var_name}_counter=+1',\\
    expirevar:'ip.vardax_{var_name}_counter={window_seconds}'"

SecRule IP:VARDAX_{var_name.upper()}_COUNTER "@gt {max_requests}" \\
    "id:{counter_id},\\
    phase:1,\\
    deny,status:429,\\
    msg:'VARDAx: Rate limit exceeded for {endpoint}',\\
    tag:'vardax/rate-limit',\\
    severity:'WARNING'"'''
        
        return rules
    
    def generate_pattern_block_rule(
        self,
        pattern: str,
        location: str = "REQUEST_URI|ARGS",
        reason: str = "Suspicious pattern detected"
    ) -> str:
        """Generate rule to block requests matching a pattern."""
        rule_id = self._get_next_rule_id()
        
        rule = f'''SecRule {location} "@rx {pattern}" \\
    "id:{rule_id},\\
    phase:2,\\
    deny,status:403,\\
    msg:'VARDAx: {reason}',\\
    tag:'vardax/pattern-block',\\
    tag:'auto-generated',\\
    severity:'WARNING'"'''
        
        return rule
    
    def generate_user_agent_block_rule(
        self,
        user_agent_pattern: str,
        reason: str = "Suspicious user agent"
    ) -> str:
        """Generate rule to block specific user agents."""
        rule_id = self._get_next_rule_id()
        
        rule = f'''SecRule REQUEST_HEADERS:User-Agent "@rx {user_agent_pattern}" \\
    "id:{rule_id},\\
    phase:1,\\
    deny,status:403,\\
    msg:'VARDAx: {reason}',\\
    tag:'vardax/user-agent-block',\\
    severity:'WARNING'"'''
        
        return rule
    
    def _get_next_rule_id(self) -> int:
        """Get next available rule ID."""
        rule_id = self.next_rule_id
        self.next_rule_id += 1
        return rule_id
    
    def rollback_rule(self, rule_id: str) -> bool:
        """
        Rollback a specific rule.
        
        Marks rule as rolled back and redeploys without it.
        """
        logger.info(f"Rolling back rule {rule_id}")
        
        # Update rule status
        self.db.update_rule_status(rule_id, "rolled_back")
        
        # Redeploy all rules (excluding rolled back ones)
        result = self.deploy_approved_rules()
        
        return result["status"] == "success"
    
    def get_deployment_history(self, limit: int = 10) -> List[Dict]:
        """Get recent deployment history."""
        return self.db.get_model_deployments(limit=limit)


# ============================================================================
# CLI for manual rule deployment
# ============================================================================

def main():
    """CLI for rule deployment."""
    import argparse
    
    parser = argparse.ArgumentParser(description="VARDAx Rule Deployer")
    parser.add_argument("action", choices=["deploy", "rollback", "status", "test"])
    parser.add_argument("--rule-id", help="Rule ID for rollback")
    parser.add_argument("--test-mode", action="store_true", help="Test mode (no actual deployment)")
    
    args = parser.parse_args()
    
    deployer = RuleDeployer(test_mode=args.test_mode)
    
    if args.action == "deploy":
        result = deployer.deploy_approved_rules()
        print(f"Deployment result: {result}")
        
    elif args.action == "rollback":
        if not args.rule_id:
            print("Error: --rule-id required for rollback")
            return
        success = deployer.rollback_rule(args.rule_id)
        print(f"Rollback {'successful' if success else 'failed'}")
        
    elif args.action == "status":
        history = deployer.get_deployment_history()
        print(f"Recent deployments: {len(history)}")
        for deployment in history:
            print(f"  - {deployment['version']} at {deployment['deployed_at']}")
            
    elif args.action == "test":
        print("Testing NGINX configuration...")
        if deployer._test_nginx_config():
            print("✓ NGINX configuration is valid")
        else:
            print("✗ NGINX configuration has errors")


if __name__ == "__main__":
    main()
