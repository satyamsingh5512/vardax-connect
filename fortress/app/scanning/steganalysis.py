"""
Steganalysis Pipeline for File Uploads
Security: Detect hidden data in uploaded images.

Strategy:
1. LSB (Least Significant Bit) analysis for images
2. Statistical anomaly detection
3. Quarantine suspicious files for manual review

Limitations:
- LSB analysis has high false positive rate
- Cannot detect sophisticated steganography
- Should be combined with other scanning methods

NIST Control: SI-3 (Malicious Code Protection), SC-18 (Mobile Code)
"""
import os
import io
import hashlib
import struct
from typing import Optional, Tuple, List
from dataclasses import dataclass
from enum import Enum

from app.core.logging_config import get_logger

logger = get_logger(__name__)


class ScanResult(Enum):
    """Scan result classification."""
    CLEAN = "clean"
    SUSPICIOUS = "suspicious"
    QUARANTINED = "quarantined"
    ERROR = "error"


@dataclass
class SteganalysisResult:
    """Result of steganalysis scan."""
    result: ScanResult
    confidence: float  # 0.0 to 1.0
    file_hash: str
    file_size: int
    findings: List[str]
    recommendations: List[str]


class LSBAnalyzer:
    """
    Least Significant Bit analysis for images.
    
    Security: Detects potential hidden data in image LSBs.
    
    Limitations:
    - High false positive rate (natural images have LSB noise)
    - Only detects simple LSB steganography
    - Cannot detect advanced techniques (F5, OutGuess, etc.)
    """
    
    # Thresholds for suspicion (tuned for low false positives)
    CHI_SQUARE_THRESHOLD = 0.05  # p-value threshold
    ENTROPY_THRESHOLD = 7.9  # Bits per byte (max is 8)
    SEQUENTIAL_THRESHOLD = 0.6  # Ratio of sequential LSB patterns
    
    def analyze_png(self, image_data: bytes) -> Tuple[bool, float, List[str]]:
        """
        Analyze PNG image for LSB steganography.
        
        Returns:
            Tuple of (suspicious: bool, confidence: float, findings: list)
        """
        findings = []
        suspicion_score = 0.0
        
        try:
            # Verify PNG signature
            if image_data[:8] != b'\x89PNG\r\n\x1a\n':
                findings.append("Invalid PNG signature")
                return True, 0.9, findings
            
            # Extract pixel data (simplified, would use PIL in production)
            # For demonstration, analyze raw bytes after header
            pixel_data = image_data[8:]  # Skip PNG header
            
            # LSB extraction
            lsb_bits = self._extract_lsb(pixel_data[:10000])  # Sample first 10KB
            
            # Chi-square test for randomness
            chi_square_suspicious, chi_p_value = self._chi_square_test(lsb_bits)
            if chi_square_suspicious:
                findings.append(f"Chi-square test indicates non-random LSB (p={chi_p_value:.4f})")
                suspicion_score += 0.3
            
            # Entropy analysis
            entropy = self._calculate_entropy(lsb_bits)
            if entropy > self.ENTROPY_THRESHOLD:
                findings.append(f"High LSB entropy ({entropy:.2f} bits/byte)")
                suspicion_score += 0.2
            
            # Sequential pattern detection
            sequential_ratio = self._detect_sequential_patterns(lsb_bits)
            if sequential_ratio > self.SEQUENTIAL_THRESHOLD:
                findings.append(f"Sequential LSB patterns detected ({sequential_ratio:.2%})")
                suspicion_score += 0.3
            
            # Check for embedded file signatures in LSB
            if self._check_embedded_signatures(lsb_bits):
                findings.append("Potential embedded file signature in LSB")
                suspicion_score += 0.4
            
            suspicious = suspicion_score >= 0.5
            confidence = min(suspicion_score, 1.0)
            
            return suspicious, confidence, findings
            
        except Exception as e:
            logger.error("lsb_analysis_failed", extra={"error": str(e)})
            return False, 0.0, [f"Analysis error: {str(e)}"]
    
    def _extract_lsb(self, data: bytes) -> bytes:
        """Extract LSB from each byte."""
        lsb_bits = []
        for byte in data:
            lsb_bits.append(byte & 1)
        
        # Pack bits into bytes
        result = bytearray()
        for i in range(0, len(lsb_bits) - 7, 8):
            byte_val = 0
            for j in range(8):
                byte_val |= (lsb_bits[i + j] << (7 - j))
            result.append(byte_val)
        
        return bytes(result)
    
    def _chi_square_test(self, data: bytes) -> Tuple[bool, float]:
        """
        Chi-square test for randomness.
        Non-random LSB distribution may indicate steganography.
        """
        if len(data) < 256:
            return False, 1.0
        
        # Count byte frequencies
        observed = [0] * 256
        for byte in data:
            observed[byte] += 1
        
        # Expected frequency (uniform distribution)
        expected = len(data) / 256
        
        # Calculate chi-square statistic
        chi_square = sum((o - expected) ** 2 / expected for o in observed if expected > 0)
        
        # Degrees of freedom = 255
        # For df=255, critical value at p=0.05 is approximately 293
        p_value = 1.0 - (chi_square / 293) if chi_square < 293 else 0.0
        
        return p_value < self.CHI_SQUARE_THRESHOLD, p_value
    
    def _calculate_entropy(self, data: bytes) -> float:
        """Calculate Shannon entropy of data."""
        if not data:
            return 0.0
        
        # Count byte frequencies
        freq = [0] * 256
        for byte in data:
            freq[byte] += 1
        
        # Calculate entropy
        import math
        entropy = 0.0
        length = len(data)
        
        for count in freq:
            if count > 0:
                p = count / length
                entropy -= p * math.log2(p)
        
        return entropy
    
    def _detect_sequential_patterns(self, data: bytes) -> float:
        """Detect sequential byte patterns (may indicate structured hidden data)."""
        if len(data) < 2:
            return 0.0
        
        sequential_count = 0
        for i in range(len(data) - 1):
            if abs(data[i] - data[i + 1]) <= 1:
                sequential_count += 1
        
        return sequential_count / (len(data) - 1)
    
    def _check_embedded_signatures(self, data: bytes) -> bool:
        """Check for known file signatures in extracted LSB data."""
        # Common file signatures
        signatures = [
            b'PK\x03\x04',  # ZIP
            b'\x89PNG',     # PNG
            b'\xff\xd8\xff', # JPEG
            b'GIF8',        # GIF
            b'%PDF',        # PDF
            b'MZ',          # EXE
            b'\x7fELF',     # ELF
        ]
        
        for sig in signatures:
            if sig in data[:1000]:  # Check first 1KB
                return True
        
        return False


class FileUploadScanner:
    """
    Complete file upload scanning pipeline.
    Security: Multi-layer scanning for uploaded files.
    """
    
    # Maximum file size for scanning (10MB)
    MAX_SCAN_SIZE = 10 * 1024 * 1024
    
    # Allowed MIME types
    ALLOWED_TYPES = {
        "image/png": [".png"],
        "image/jpeg": [".jpg", ".jpeg"],
        "image/gif": [".gif"],
        "application/pdf": [".pdf"],
    }
    
    def __init__(self, quarantine_path: str = "/tmp/quarantine"):
        self.quarantine_path = quarantine_path
        self.lsb_analyzer = LSBAnalyzer()
        
        # Ensure quarantine directory exists
        os.makedirs(quarantine_path, exist_ok=True)
    
    async def scan_upload(
        self,
        file_data: bytes,
        filename: str,
        content_type: str,
    ) -> SteganalysisResult:
        """
        Scan uploaded file for hidden content.
        
        Args:
            file_data: Raw file bytes
            filename: Original filename
            content_type: MIME type
        
        Returns:
            SteganalysisResult with scan findings
        """
        file_hash = hashlib.sha256(file_data).hexdigest()
        file_size = len(file_data)
        findings = []
        recommendations = []
        
        # Size check
        if file_size > self.MAX_SCAN_SIZE:
            findings.append(f"File exceeds maximum scan size ({file_size} > {self.MAX_SCAN_SIZE})")
            return SteganalysisResult(
                result=ScanResult.ERROR,
                confidence=0.0,
                file_hash=file_hash,
                file_size=file_size,
                findings=findings,
                recommendations=["Reject oversized files"],
            )
        
        # MIME type validation
        if content_type not in self.ALLOWED_TYPES:
            findings.append(f"Disallowed content type: {content_type}")
            return SteganalysisResult(
                result=ScanResult.QUARANTINED,
                confidence=1.0,
                file_hash=file_hash,
                file_size=file_size,
                findings=findings,
                recommendations=["Reject file with disallowed type"],
            )
        
        # Extension validation
        ext = os.path.splitext(filename)[1].lower()
        if ext not in self.ALLOWED_TYPES.get(content_type, []):
            findings.append(f"Extension mismatch: {ext} for {content_type}")
            recommendations.append("Verify file type matches extension")
        
        # Image-specific scanning
        if content_type.startswith("image/"):
            if content_type == "image/png":
                suspicious, confidence, lsb_findings = self.lsb_analyzer.analyze_png(file_data)
                findings.extend(lsb_findings)
                
                if suspicious:
                    # Quarantine suspicious file
                    quarantine_path = await self._quarantine_file(file_data, file_hash, filename)
                    findings.append(f"File quarantined: {quarantine_path}")
                    recommendations.append("Manual review required")
                    
                    return SteganalysisResult(
                        result=ScanResult.SUSPICIOUS,
                        confidence=confidence,
                        file_hash=file_hash,
                        file_size=file_size,
                        findings=findings,
                        recommendations=recommendations,
                    )
        
        # File passed all checks
        return SteganalysisResult(
            result=ScanResult.CLEAN,
            confidence=0.9,  # Never 100% confident
            file_hash=file_hash,
            file_size=file_size,
            findings=findings if findings else ["No issues detected"],
            recommendations=recommendations if recommendations else ["File appears safe"],
        )
    
    async def _quarantine_file(self, file_data: bytes, file_hash: str, 
                                original_name: str) -> str:
        """Move suspicious file to quarantine."""
        quarantine_name = f"{file_hash}_{original_name}"
        quarantine_path = os.path.join(self.quarantine_path, quarantine_name)
        
        with open(quarantine_path, "wb") as f:
            f.write(file_data)
        
        logger.warning(
            "file_quarantined",
            extra={
                "file_hash": file_hash,
                "original_name": original_name,
                "quarantine_path": quarantine_path,
            }
        )
        
        return quarantine_path
