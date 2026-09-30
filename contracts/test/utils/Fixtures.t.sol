// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WebAuthn} from "../../src/lib/WebAuthn.sol";

/// @title Fixtures — 加载 node 生成的 P-256 / WebAuthn 测试夹具
/// @dev 先运行 `node test/fixtures/generate.mjs` 生成 fixtures.json。
///      挑战派生约定（与 FixedChallengeAccount 一致）：
///        single(n) = sha256(base ‖ 0x01 ‖ uint256be(n))
///        batch(n)  = sha256(base ‖ 0x02 ‖ uint256be(n))
///      其中 base = fixtures.challenge（固定 32 字节）。
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
