
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LandGuardRegistryV2 {

    address public immutable contractOwner;

    mapping(address => bool) public authorizedWriters;

    struct ApplicationRecord {
        bytes32 commitment;
        uint256 registeredAt;
        address registeredBy;
    }

    mapping(bytes32 => ApplicationRecord[]) private applicationHistory;

    event WriterAuthorizationChanged(
        address indexed writer,
        bool authorized
    );

    event ApplicationRegistered(
        bytes32 indexed applicationId,
        address indexed registeredBy,
        uint256 version
    );

    event ApplicationUpdated(
        bytes32 indexed applicationId,
        address indexed updatedBy,
        uint256 version
    );

    constructor() {
        contractOwner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == contractOwner, "Not authorised");
        _;
    }

    modifier onlyWriter() {
        require(
            msg.sender == contractOwner ||
            authorizedWriters[msg.sender],
            "Not an authorised writer"
        );
        _;
    }

    // Grant or revoke registration permissions.
    function setAuthorizedWriter(
        address writer,
        bool authorized
    ) external onlyOwner {
        require(writer != address(0), "Invalid wallet");

        authorizedWriters[writer] = authorized;

        emit WriterAuthorizationChanged(writer, authorized);
    }

    // Register the first proof for an application.
    function registerApplication(
        bytes32 applicationId,
        bytes32 commitment
    ) external onlyWriter {
        require(applicationId != bytes32(0), "Invalid ID");
        require(commitment != bytes32(0), "Invalid commitment");

        require(
            applicationHistory[applicationId].length == 0,
            "Already registered"
        );

        applicationHistory[applicationId].push(
            ApplicationRecord({
                commitment: commitment,
                registeredAt: block.timestamp,
                registeredBy: msg.sender
            })
        );

        emit ApplicationRegistered(applicationId, msg.sender, 1);
    }

    // Append a new version without deleting older proofs.
    function updateApplication(
        bytes32 applicationId,
        bytes32 newCommitment
    ) external onlyWriter {
        require(newCommitment != bytes32(0), "Invalid commitment");

        uint256 count = applicationHistory[applicationId].length;
        require(count > 0, "Application not registered");

        require(
            applicationHistory[applicationId][count - 1].commitment
                != newCommitment,
            "Commitment unchanged"
        );

        applicationHistory[applicationId].push(
            ApplicationRecord({
                commitment: newCommitment,
                registeredAt: block.timestamp,
                registeredBy: msg.sender
            })
        );

        emit ApplicationUpdated(
            applicationId,
            msg.sender,
            count + 1
        );
    }

    // Verify against the latest registered version.
    function verifyApplication(
        bytes32 applicationId,
        bytes32 commitment
    ) external view returns (bool) {
        uint256 count = applicationHistory[applicationId].length;

        if (count == 0) {
            return false;
        }

        return (
            applicationHistory[applicationId][count - 1].commitment
                == commitment
        );
    }

    // Retrieve the most recent registered proof.
    function getApplicationProof(
        bytes32 applicationId
    ) external view returns (
        bytes32 commitment,
        uint256 registeredAt,
        address registeredBy
    ) {
        uint256 count = applicationHistory[applicationId].length;
        require(count > 0, "Application not found");

        ApplicationRecord storage record =
            applicationHistory[applicationId][count - 1];

        return (
            record.commitment,
            record.registeredAt,
            record.registeredBy
        );
    }

    // Number of recorded versions.
    function getApplicationVersionCount(
        bytes32 applicationId
    ) external view returns (uint256) {
        return applicationHistory[applicationId].length;
    }

    // Retrieve a historical version, starting at version 1.
    function getApplicationVersion(
        bytes32 applicationId,
        uint256 version
    ) external view returns (
        bytes32 commitment,
        uint256 registeredAt,
        address registeredBy
    ) {
        uint256 count = applicationHistory[applicationId].length;

        require(
            version > 0 && version <= count,
            "Invalid version"
        );

        ApplicationRecord storage record =
            applicationHistory[applicationId][version - 1];

        return (
            record.commitment,
            record.registeredAt,
            record.registeredBy
        );
    }
}


