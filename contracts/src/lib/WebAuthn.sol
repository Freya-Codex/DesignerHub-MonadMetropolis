// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {P256} from "./P256.sol";

/// @title WebAuthn — 服务端（合约侧）验证 WebAuthn 断言
/// @notice 按 W3C WebAuthn Level 2 规范校验一条 passkey 断言：
///         1. authenticatorData ≥ 37 字节，前 32 字节 == sha256(RP ID)；
///         2. flags 的 UP（User Present，bit0）必须置位；
///         3. clientDataJSON 中 type == "webauthn.get"；
///         4. clientDataJSON 中 challenge（base64url，43 字符）解码后 == 期望挑战；
///         5. 断言签名覆盖 sha256(authenticatorData ‖ sha256(clientDataJSON))；
///         6. 用 P-256 验签（自动走 0x100 预编译或纯 Solidity 路径）。
/// @dev 解析为「最小实现」：提取 JSON 字符串值时不处理转义序列。
///      依赖方（本协议 web 端）保证 challenge / origin 中不含需要转义的字符。
library WebAuthn {
    /// @notice 一条 WebAuthn 断言的原始材料与 P-256 签名（r‖s 拆为两个 uint256）。
    struct Assertion {
        bytes authenticatorData; // 37+ 字节：rpIdHash(32) ‖ flags(1) ‖ signCount(4) ‖ extensions
        bytes clientDataJSON; // 浏览器序列化的 JSON
        uint256 r; // P-256 签名 r
        uint256 s; // P-256 签名 s
    }

    /// @notice 校验一条断言是否由持有 publicKey 的 passkey 签出，且挑战值匹配。
    /// @param assertion 断言原始材料。
    /// @param challenge 期望的 32 字节挑战（由调用方按操作内容派生，含防重放要素）。
    /// @param rpIdHash 期望的 sha256(RP ID)，如 sha256("designerhub.xyz")。
    /// @param keyX / keyY passkey 的 P-256 公钥。
    function verify(Assertion memory assertion, bytes32 challenge, bytes32 rpIdHash, uint256 keyX, uint256 keyY)
        internal
        view
        returns (bool)
    {
        bytes memory ad = assertion.authenticatorData;
        // 1. 长度：rpIdHash(32) + flags(1) + signCount(4) = 37 字节最小值
        if (ad.length < 37) return false;
        // 2. RP ID 哈希
        bytes32 adRpIdHash;
        assembly {
            adRpIdHash := mload(add(ad, 32)) // bytes 内存布局：0 槽为长度，数据从 32 起
        }
        if (adRpIdHash != rpIdHash) return false;
        // 3. flags：UP（bit0）置位
        uint8 flags = uint8(ad[32]);
        if (flags & 0x01 == 0) return false;
        // 4. clientDataJSON：type 必须为 "webauthn.get"
        bytes memory cd = assertion.clientDataJSON;
        (bytes memory typeValue, bool okType) = extractJsonString(cd, "type");
        if (!okType || typeValue.length != 12) return false;
        bytes memory expectedType = "webauthn.get";
        for (uint256 i = 0; i < 12; i++) {
            if (typeValue[i] != expectedType[i]) return false;
        }
        // 5. 挑战匹配（base64url 解码后比对）
        (bytes memory challengeValue, bool okChallenge) = extractJsonString(cd, "challenge");
        if (!okChallenge || challengeValue.length != 43) return false;
        if (_base64UrlDecode32(challengeValue) != challenge) return false;
        // 6. 断言消息哈希 = sha256(authenticatorData ‖ sha256(clientDataJSON))（W3C 规范）
        bytes32 messageHash = sha256(abi.encodePacked(ad, sha256(cd)));
        // 7. P-256 验签
        return P256.verify(messageHash, assertion.r, assertion.s, keyX, keyY);
    }

    /// @notice 从 clientDataJSON 中提取字符串字段值（不做转义处理）。
    ///         公开给账户合约做 origin 校验复用。
    /// @return value 形如 "key":"value" 中 value 的原始字节；found 表示是否找到完整字段。
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

    /// @notice 解码 43 字符 base64url → 32 字节（末尾 2 个填充位丢弃）。
    /// @dev 本协议挑战恒为 32 字节，浏览器会输出恰好 43 个 base64url 字符。
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
            // 清掉已消费的高位，防止 acc 无限增长
            acc &= (1 << bits) - 1;
        }
    }
}
