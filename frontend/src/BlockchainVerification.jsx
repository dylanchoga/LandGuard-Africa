
import { useState } from "react";

import {
  verifyHousingApplication,
  getApplicationProof,
} from "./contracts/landguardService";

export default function BlockchainVerification() {
  const [applicationId, setApplicationId] = useState("");
  const [commitment, setCommitment] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleVerification(event) {
    event.preventDefault();

    setLoading(true);
    setResult(null);
    setError("");

    try {
      const id = applicationId.trim();
      const proofValue = commitment.trim();

      const isValid = await verifyHousingApplication(
        id,
        proofValue
      );

      let record = null;

      if (isValid) {
        record = await getApplicationProof(id);
      }

      setResult({
        valid: isValid,
        record,
      });
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "14px",
    border: "1px solid #d5e3dd",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#173d31",
  };

  return (
    <section
      style={{
        maxWidth: "850px",
        margin: "0 auto",
        padding: "30px",
        background: "#ffffff",
        borderRadius: "18px",
        color: "#173d31",
        boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ marginBottom: "26px" }}>
        <p
          style={{
            color: "#16845d",
            fontWeight: "700",
            fontSize: "13px",
          }}
        >
          LANDGUARD AFRICA
        </p>

        <h2 style={{ fontSize: "27px", marginBottom: "10px" }}>
          Blockchain Record Verification
        </h2>

        <p style={{ color: "#667a70", lineHeight: "1.6" }}>
          Independently verify whether a housing application
          record matches its registered blockchain proof.
        </p>
      </div>

      <form onSubmit={handleVerification}>
        <div style={{ marginBottom: "20px" }}>
          <label
            htmlFor="blockchain-application-id"
            style={{ display: "block", marginBottom: "8px" }}
          >
            Application Record ID
          </label>

          <input
            id="blockchain-application-id"
            type="text"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            placeholder="0x..."
            style={inputStyle}
            required
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="blockchain-commitment"
            style={{ display: "block", marginBottom: "8px" }}
          >
            Record Commitment
          </label>

          <input
            id="blockchain-commitment"
            type="text"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            placeholder="0x..."
            style={inputStyle}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "14px 24px",
            width: "100%",
            background: loading ? "#78978b" : "#126b4d",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            cursor: loading ? "wait" : "pointer",
            fontWeight: "700",
            fontSize: "15px",
          }}
        >
          {loading ? "Verifying record..." : "Verify Record"}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: "24px",
            padding: "18px",
            borderRadius: "10px",
            background: "#fff0ed",
            color: "#a43423",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          role="status"
          style={{
            marginTop: "24px",
            padding: "22px",
            borderRadius: "12px",
            background: result.valid ? "#e9f7ee" : "#fff1ee",
            color: result.valid ? "#17613f" : "#ac3726",
          }}
        >
          <h3>
            {result.valid
              ? "Record Integrity Verified"
              : "Record Not Verified"}
          </h3>

          <p>
            {result.valid
              ? "The supplied commitment matches the record registered on Avalanche."
              : "The supplied commitment does not match a registered proof for this application ID."}
          </p>

          {result.record && (
            <div
              style={{
                marginTop: "18px",
                fontSize: "13px",
                overflowWrap: "anywhere",
                lineHeight: "1.8",
              }}
            >
              <p>
                <strong>Registered:</strong>{" "}
                {new Date(
                  result.record.registeredAt * 1000
                ).toLocaleString()}
              </p>
              <p>
                <strong>Registered by:</strong>{" "}
                {result.record.registeredBy}
              </p>
              <p>
                <strong>Network:</strong> Avalanche Fuji
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
