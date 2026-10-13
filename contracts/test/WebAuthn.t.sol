// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WebAuthn} from "../src/lib/WebAuthn.sol";
import {Fixtures} from "./utils/Fixtures.t.sol";

/// @title WebAuthnTest — WebAuthn assertion verification regression
contract WebAuthnTest is Fixtures {
    using WebAuthn for WebAuthn.Assertion;

    bytes32 internal base;
    uint256 internal x1;
    uint256 internal y1;
    uint256 internal x2;
    uint256 internal y2;

    function setUp() public override {
        super.setUp();
        base = _fxBytes32(".challenge");
        (x1, y1) = _fxKey(0);
        (x2, y2) = _fxKey(1);
    }

    // ------------------------------ Positive ------------------------------- //

    function test_Verify_Key1SingleN0() public view {
        WebAuthn.Assertion memory a = _fxAssertion("key1_single_n0");
        assertTrue(a.verify(_challengeSingle(0), fxRpIdHash, x1, y1));
    }

    function test_Verify_Key2SingleN1() public view {
        WebAuthn.Assertion memory a = _fxAssertion("key2_single_n1");
        assertTrue(a.verify(_challengeSingle(1), fxRpIdHash, x2, y2));
    }

    // ------------------------------ Negative ------------------------------- //

    function test_Verify_WrongNonceChallenge() public view {
        WebAuthn.Assertion memory a = _fxAssertion("key1_single_n0");
        assertFalse(a.verify(_challengeSingle(1), fxRpIdHash, x1, y1), "challenge mismatch must fail");
    }

    function test_Verify_BatchChallengeOnSingle() public view {
        // Domain separation: a single assertion cannot pass batch challenge verification
        WebAuthn.Assertion memory a = _fxAssertion("key1_single_n0");
        assertFalse(a.verify(sha256(abi.encodePacked(base, uint8(2), uint256(0))), fxRpIdHash, x1, y1));
    }

    function test_Verify_WrongRpId() public view {
        WebAuthn.Assertion memory a = _fxAssertion("wrongRp");
        assertFalse(a.verify(_challengeSingle(0), fxRpIdHash, x1, y1));
    }

    function test_Verify_WrongType() public view {
        WebAuthn.Assertion memory a = _fxAssertion("wrongType");
        assertFalse(a.verify(_challengeSingle(0), fxRpIdHash, x1, y1));
    }

    function test_Verify_TamperedSignature() public view {
        WebAuthn.Assertion memory a = _fxAssertion("tamperedSig");
        assertFalse(a.verify(_challengeSingle(0), fxRpIdHash, x1, y1));
    }

    function test_Verify_WrongKey() public view {
        WebAuthn.Assertion memory a = _fxAssertion("key1_single_n0");
        assertFalse(a.verify(_challengeSingle(0), fxRpIdHash, x2, y2));
    }

    function test_Verify_ShortAuthenticatorData() public view {
        WebAuthn.Assertion memory a = _fxAssertion("key1_single_n0");
        a.authenticatorData = _truncate(a.authenticatorData, 36);
        assertFalse(a.verify(_challengeSingle(0), fxRpIdHash, x1, y1));
    }

    function test_Verify_UserPresentFlagCleared() public view {
        WebAuthn.Assertion memory a = _fxAssertion("key1_single_n0");
        // Clear the flags byte (UP bit0 = 0)
        a.authenticatorData = _withFlag(a.authenticatorData, 0x00);
        assertFalse(a.verify(_challengeSingle(0), fxRpIdHash, x1, y1));
    }

    // --------------------------- JSON extraction --------------------------- //

    function test_ExtractJsonString_Fields() public view {
        WebAuthn.Assertion memory a = _fxAssertion("key1_single_n0");
        (bytes memory typeValue, bool okType) = WebAuthn.extractJsonString(a.clientDataJSON, "type");
        assertTrue(okType);
        assertEq(string(typeValue), "webauthn.get");

        (bytes memory originValue, bool okOrigin) = WebAuthn.extractJsonString(a.clientDataJSON, "origin");
        assertTrue(okOrigin);
        assertEq(string(originValue), fxOrigin);

        (bytes memory challengeValue, bool okChallenge) = WebAuthn.extractJsonString(a.clientDataJSON, "challenge");
        assertTrue(okChallenge);
        assertEq(challengeValue.length, 43, "32-byte challenge is 43 base64url chars");
    }

    function test_ExtractJsonString_MissingKey() public pure {
        bytes memory cd = bytes('{"type":"webauthn.get"}');
        (, bool ok) = WebAuthn.extractJsonString(cd, "origin");
        assertFalse(ok);
    }

    // ------------------------------ Internal ------------------------------- //

    function _challengeSingle(uint256 n) internal view returns (bytes32) {
        return sha256(abi.encodePacked(base, uint8(1), n));
    }

    /// @dev Truncate bytes (memory arrays do not support slicing; use mcopy).
    function _truncate(bytes memory src, uint256 len) internal pure returns (bytes memory dst) {
        dst = new bytes(len);
        assembly {
            mcopy(add(dst, 32), add(src, 32), len)
        }
    }

    /// @dev Rewrite the flags byte of authenticatorData (data[32]).
    function _withFlag(bytes memory src, uint8 flag) internal pure returns (bytes memory dst) {
        dst = new bytes(src.length);
        assembly {
            mcopy(add(dst, 32), add(src, 32), mload(src))
            mstore8(add(dst, 64), flag) // data[32] = flags
        }
    }
}
