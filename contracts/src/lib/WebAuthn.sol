// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {P256} from "./P256.sol";

/// @title WebAuthn — server-side (contract-side) verification of WebAuthn assertions
/// @notice Verifies a passkey assertion per the W3C WebAuthn Level 2 spec:
///         1. authenticatorData ≥ 37 bytes, first 32 bytes == sha256(RP ID);
///         2. flags UP (User Present, bit0) must be set;
///         3. in clientDataJSON, type == "webauthn.get";
///         4. in clientDataJSON, challenge (base64url, 43 chars) decoded == the expected challenge;
///         5. the assertion signature covers sha256(authenticatorData ‖ sha256(clientDataJSON));
///         6. verify with P-256 (auto via the 0x100 precompile or the pure-Solidity path).
/// @dev A "minimal implementation" of parsing: escape sequences are not handled when extracting JSON string values.
///      The relying party (this protocol's web front end) guarantees challenge / origin contain no characters needing escapes.
library WebAuthn {
    /// @notice The raw material of a WebAuthn assertion and its P-256 signature (r‖s split into two uint256s).
    struct Assertion {
        bytes authenticatorData; // 37+ bytes: rpIdHash(32) ‖ flags(1) ‖ signCount(4) ‖ extensions
        bytes clientDataJSON; // the JSON serialized by the browser
        uint256 r; // P-256 signature r
        uint256 s; // P-256 signature s
    }

    /// @notice Verify whether an assertion was signed by the passkey holding publicKey, and that the challenge matches.
    /// @param assertion the raw assertion material.
    /// @param challenge the expected 32-byte challenge (derived by the caller from the operation, including replay-protection elements).
    /// @param rpIdHash the expected sha256(RP ID), e.g. sha256("designerhub.xyz").
    /// @param keyX / keyY the P-256 public key of the passkey.
    function verify(Assertion memory assertion, bytes32 challenge, bytes32 rpIdHash, uint256 keyX, uint256 keyY)
        internal
        view
        returns (bool)
    {
        bytes memory ad = assertion.authenticatorData;
        // 1. Length: rpIdHash(32) + flags(1) + signCount(4) = 37 bytes minimum
        if (ad.length < 37) return false;
        // 2. RP ID hash
        bytes32 adRpIdHash;
        assembly {
            adRpIdHash := mload(add(ad, 32)) // bytes memory layout: slot 0 is the length, data starts at 32
        }
        if (adRpIdHash != rpIdHash) return false;
        // 3. flags: UP (bit0) set
        uint8 flags = uint8(ad[32]);
        if (flags & 0x01 == 0) return false;
        // 4. clientDataJSON: type must be "webauthn.get"
        bytes memory cd = assertion.clientDataJSON;
        (bytes memory typeValue, bool okType) = extractJsonString(cd, "type");
        if (!okType || typeValue.length != 12) return false;
        bytes memory expectedType = "webauthn.get";
        for (uint256 i = 0; i < 12; i++) {
            if (typeValue[i] != expectedType[i]) return false;
        }
        // 5. challenge match (compare after base64url decoding)
        (bytes memory challengeValue, bool okChallenge) = extractJsonString(cd, "challenge");
        if (!okChallenge || challengeValue.length != 43) return false;
        if (_base64UrlDecode32(challengeValue) != challenge) return false;
        // 6. assertion message hash = sha256(authenticatorData ‖ sha256(clientDataJSON)) (W3C spec)
        bytes32 messageHash = sha256(abi.encodePacked(ad, sha256(cd)));
        // 7. P-256 verification
        return P256.verify(messageHash, assertion.r, assertion.s, keyX, keyY);
    }

    /// @notice Extract a string field value from clientDataJSON (no escape handling).
    ///         Exposed so the account contract can reuse it for origin verification.
    /// @return value the raw bytes of the value in "key":"value"; found indicates whether the complete field was found.
    function extractJsonString(bytes memory data, string memory key)
        internal
        pure
        returns (bytes memory value, bool found)
    {
        bytes memory needle = abi.encodePacked('"', key, '":"');
        uint256 dLen = data.length;
        uint256 nLen = needle.length;
        if (dLen < nLen) return ("", false);
        for (uint256 i = 0; i + nLen <= dLen; i++) {
            bool matched = true;
            for (uint256 j = 0; j < nLen; j++) {
                if (data[i + j] != needle[j]) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                uint256 start = i + nLen;
                uint256 end = start;
                while (end < dLen && data[end] != '"') {
                    end++;
                }
                if (end >= dLen) return ("", false);
                value = new bytes(end - start);
                for (uint256 k = 0; k < end - start; k++) {
                    value[k] = data[start + k];
                }
                return (value, true);
            }
        }
        return ("", false);
    }

    /// @notice Decode a 43-char base64url string → 32 bytes (the trailing 2 padding bits are dropped).
    /// @dev In this protocol the challenge is always 32 bytes, and the browser outputs exactly 43 base64url chars.
    function _base64UrlDecode32(bytes memory s) private pure returns (bytes32 out) {
        if (s.length != 43) return 0;
        uint256 acc;
        uint256 bits;
        for (uint256 i = 0; i < 43; i++) {
            uint8 c = uint8(s[i]);
            uint8 v;
            if (c >= 65 && c <= 90) {
                v = c - 65; // A-Z → 0-25
            } else if (c >= 97 && c <= 122) {
                v = c - 97 + 26; // a-z → 26-51
            } else if (c >= 48 && c <= 57) {
                v = c - 48 + 52; // 0-9 → 52-61
            } else if (c == 45) {
                v = 62; // '-'
            } else if (c == 95) {
                v = 63; // '_'
            } else {
                return 0;
            }
            acc = (acc << 6) | v;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out = (out << 8) | bytes32(uint256(uint8(acc >> bits)));
            }
            // clear the consumed high bits to prevent acc from growing unbounded
            acc &= (1 << bits) - 1;
        }
    }
}
