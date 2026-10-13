// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ProvenanceRegistry} from "../src/ProvenanceRegistry.sol";

/// @title AgentRegistryTest — AI agent registration and reputation ledger
contract AgentRegistryTest is Test {
    AgentRegistry internal agents;
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        agents = new AgentRegistry(owner);
    }

    // ------------------------------ Register ------------------------------ //

    function test_Register_FirstAgentIdIsOne() public {
        vm.prank(alice);
        uint256 id = agents.registerAgent("ipfs://kimi");
        assertEq(id, 1);
        assertEq(agents.nextAgentId(), 2);

        assertTrue(agents.isRegistered(1));
        assertFalse(agents.isRegistered(2));

        AgentRegistry.Agent memory a = agents.agentOf(1);
        assertEq(a.metadataURI, "ipfs://kimi");
        assertEq(a.reputation, 0);
        assertTrue(a.registered);
        assertGt(a.registeredAt, 0);
    }

    function test_Register_SequentialIds() public {
        vm.prank(alice);
        uint256 id1 = agents.registerAgent("ipfs://a");
        vm.prank(bob);
        uint256 id2 = agents.registerAgent("ipfs://b");
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_Register_EmptyURIRejected() public {
        vm.expectRevert(AgentRegistry.EmptyMetadataURI.selector);
        agents.registerAgent("");
    }

    function test_AgentOf_UnregisteredReverts() public {
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotRegistered.selector, 42));
        agents.agentOf(42);
    }

    function test_ReputationOf_UnregisteredReverts() public {
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotRegistered.selector, 42));
        agents.reputationOf(42);
    }

    // ------------------------ Reputation access control ------------------- //

    function test_AddReputation_BeforeWiringRejected() public {
        vm.prank(alice);
        agents.registerAgent("ipfs://kimi");
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotProvenanceRegistry.selector, address(this)));
        agents.addReputation(1);
    }

    function test_AddReputation_OnlyProvenanceRegistry() public {
        vm.prank(alice);
        agents.registerAgent("ipfs://kimi");
        vm.prank(owner);
        agents.setProvenanceRegistry(address(0xBEEF));
        // Even after wiring, callers other than ProvenanceRegistry are rejected
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotProvenanceRegistry.selector, address(this)));
        agents.addReputation(1);
    }

    // ------------------------------- Wiring -------------------------------- //

    function test_SetProvenanceRegistry_OnlyOwner() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        agents.setProvenanceRegistry(address(0xBEEF));
    }

    function test_SetProvenanceRegistry_OnlyOnce() public {
        vm.prank(owner);
        agents.setProvenanceRegistry(address(0xBEEF));
        vm.prank(owner);
        vm.expectRevert(AgentRegistry.ProvenanceAlreadyWired.selector);
        agents.setProvenanceRegistry(address(0xCAFE));
    }

    // ------------------------- End-to-end reputation ---------------------- //

    function test_Reputation_AccumulatesViaAttestation() public {
        ProvenanceRegistry provenance = new ProvenanceRegistry(agents);
        vm.prank(owner);
        agents.setProvenanceRegistry(address(provenance));

        vm.prank(alice);
        agents.registerAgent("ipfs://kimi");

        vm.prank(alice);
        provenance.attest(keccak256("c1"), 1, "ipfs://m");
        assertEq(agents.reputationOf(1), 1);

        vm.prank(bob);
        provenance.attest(keccak256("c2"), 1, "");
        assertEq(agents.reputationOf(1), 2);

        // Attestations with agentId = 0 (no attribution) do not accrue reputation
        vm.prank(bob);
        provenance.attest(keccak256("c3"), 0, "");
        assertEq(agents.reputationOf(1), 2);
    }
}
