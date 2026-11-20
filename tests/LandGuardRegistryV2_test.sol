
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/LandGuardRegistryV2.sol";

contract LandGuardRegistryV2Test {

    function checkRegistration() public returns (bool) {
        LandGuardRegistryV2 registry = new LandGuardRegistryV2();

        bytes32 id = keccak256("test-application-1");
        bytes32 proof = keccak256("test-proof-1");

        registry.registerApplication(id, proof);

        return registry.verifyApplication(id, proof);
    }

    function checkDuplicatePrevention() public returns (bool) {
        LandGuardRegistryV2 registry = new LandGuardRegistryV2();

        bytes32 id = keccak256("test-application-2");
        bytes32 proof = keccak256("test-proof-2");

        registry.registerApplication(id, proof);

        try registry.registerApplication(id, proof) {
            return false;
        } catch {
            return true;
        }
    }

    function checkVersionHistory() public returns (bool) {
        LandGuardRegistryV2 registry = new LandGuardRegistryV2();

        bytes32 id = keccak256("test-application-3");
        bytes32 first = keccak256("first-proof");
        bytes32 second = keccak256("second-proof");

        registry.registerApplication(id, first);
        registry.updateApplication(id, second);

        (bytes32 original, , ) =
            registry.getApplicationVersion(id, 1);

        return (
            registry.getApplicationVersionCount(id) == 2 &&
            registry.verifyApplication(id, second) &&
            original == first
        );
    }
}
