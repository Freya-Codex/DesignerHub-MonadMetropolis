// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WebAuthn} from "../../src/lib/WebAuthn.sol";

/// @title Fixtures — load node-generated P-256 / WebAuthn test fixtures
/// @dev First run `node test/fixtures/generate.mjs` to generate fixtures.json.
///      Challenge derivation convention (matches FixedChallengeAccount):
///        single(n) = sha256(base ‖ 0x01 ‖ uint256be(n))
///        batch(n)  = sha256(base ‖ 0x02 ‖ uint256be(n))
///      where base = fixtures.challenge (a fixed 32 bytes).
abstract contract Fixtures is Test {
    string internal fixtures;
    string internal fxRpId;
    string internal fxOrigin;
    bytes32 internal fxRpIdHash; // sha256(rpId)
    bytes32 internal fxOriginHash; // keccak256(origin)

    function setUp() public virtual {
        fixtures = vm.readFile("test/fixtures/fixtures.json");
        fxRpId = vm.parseJsonString(fixtures, ".rpId");
        fxOrigin = vm.parseJsonString(fixtures, ".origin");
        fxRpIdHash = sha256(bytes(fxRpId));
        fxOriginHash = keccak256(bytes(fxOrigin));
    }

    function _fxBytes32(string memory path) internal view returns (bytes32) {
        return vm.parseJsonBytes32(fixtures, path);
    }

    function _fxUint(string memory path) internal view returns (uint256) {
        return uint256(vm.parseJsonBytes32(fixtures, path));
    }

    function _fxBytes(string memory path) internal view returns (bytes memory) {
        return vm.parseJsonBytes(fixtures, path);
    }

    function _fxKey(uint256 i) internal view returns (uint256 x, uint256 y) {
        x = _fxUint(string.concat(".keys[", vm.toString(i), "].x"));
        y = _fxUint(string.concat(".keys[", vm.toString(i), "].y"));
    }

    function _fxAssertion(string memory name) internal view returns (WebAuthn.Assertion memory a) {
        string memory base = string.concat(".assertions.", name);
        a = WebAuthn.Assertion({
            authenticatorData: _fxBytes(string.concat(base, ".authenticatorData")),
            clientDataJSON: _fxBytes(string.concat(base, ".clientDataJSON")),
            r: _fxUint(string.concat(base, ".r")),
            s: _fxUint(string.concat(base, ".s"))
        });
    }
}
