
import { useState } from "react";

export default function ApplicationIntegrityCheck({ applicationId, token, api }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signedWallet, setSignedWallet] = useState("");
  const [error, setError] = useState("");

  async function verifyIntegrity() {
    setLoading(true);
    setError("");
    setResult(null);
    setSignedWallet("");

    try {
      const response = await api(
        `/applications/${encodeURIComponent(applicationId)}/integrity`,
        { token }
      );
      setResult(response);
    } catch (err) {
      setError(err.message || "Verification unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function signWithBinance() {
    if (!result?.verified) return;

    setSigning(true);
    setError("");

    try {
      const [details, account] = await Promise.all([
        api(`/applications/${encodeURIComponent(applicationId)}`, { token }),
        api("/auth/me", { token }),
      ]);

      if (account.role !== "auditor") {
        throw new Error("Only the auditor account can sign audit verifications.");
      }

      const txHash = details.blockchain?.transaction_hash;

      if (details.blockchain?.status !== "CONFIRMED" || !txHash) {
        throw new Error("This application has no confirmed blockchain transaction.");
      }

      // Detect Binance Wallet specifically, not Avalanche Core.
      const provider = await new Promise((resolve) => {
        let binanceProvider = null;

        const onProvider = (event) => {
          if (event.detail?.info?.rdns === "com.binance.wallet") {
            binanceProvider = event.detail.provider;
          }
        };

        window.addEventListener("eip6963:announceProvider", onProvider);
        window.dispatchEvent(new Event("eip6963:requestProvider"));

        setTimeout(() => {
          window.removeEventListener("eip6963:announceProvider", onProvider);
          resolve(binanceProvider);
        }, 700);
      });

      if (!provider) {
        throw new Error("Binance Wallet not detected in this browser.");
      }

      const accounts = await provider.request({
        method: "eth_requestAccounts"
      });

      const address = accounts?.[0];

      if (!address) {
        throw new Error("Binance Wallet did not return an address.");
      }

      // Message must match the backend verification message.
      const message =
        "LandGuard Africa Audit Verification\n" +
        `Application ID: ${applicationId}\n` +
        `Transaction: ${txHash}\n` +
        "Network: Avalanche Fuji (43113)\n" +
        "Statement: I verified that the application matches " +
        "its registered blockchain commitment.";

      const hexMessage = "0x" + Array.from(
        new TextEncoder().encode(message),
        (byte) => byte.toString(16).padStart(2, "0")
      ).join("");

      // Request a digital signature from Binance Wallet.
      const signature = await provider.request({
        method: "personal_sign",
        params: [hexMessage, address],
      });

      // Send the signature to LandGuard for verification and storage.
      await api(
        `/applications/${encodeURIComponent(applicationId)}/binance-audit`,
        {
          token,
          method: "POST",
          body: { address, signature },
        }
      );

      setSignedWallet(address);

    } catch (err) {
      setError(err.message || "Binance audit signing failed.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <section
      className="surfacePanel"
      style={{ padding: "24px", marginBottom: "20px" }}
    >
      <h3 style={{ marginBottom: "8px", color: "#164b3b" }}>
        Blockchain Integrity Check
      </h3>

      <p style={{ color: "#667c72", marginBottom: "18px" }}>
        Verify this application's current database record against
        its registered proof on Avalanche Fuji.
      </p>

      <button
        type="button"
        onClick={verifyIntegrity}
        disabled={loading || signing}
        className="button primary"
      >
        {loading ? "Checking Avalanche..." : "Verify Integrity"}
      </button>

      {result && (
        <div
          role="status"
          style={{
            marginTop: "20px",
            padding: "18px",
            borderRadius: "10px",
            background: result.verified ? "#e8f7ee" : "#fff3e5",
            color: result.verified ? "#17613f" : "#925600",
          }}
        >
          <strong>
            {result.verified
              ? "Record Integrity Verified"
              : "Record Not Verified"}
          </strong>

          <p style={{ marginTop: "8px" }}>
            {result.verified
              ? "The current housing application record matches its blockchain commitment."
              : "The current record does not match a registered proof. It may be unregistered, updated, or inconsistent and requires investigation."}
          </p>

          <p style={{ marginTop: "10px", fontSize: "13px" }}>
            Network: {result.network} | Chain ID: {result.chain_id}
          </p>

          {result.verified && (
            <div style={{ marginTop: "18px" }}>
              <button
                type="button"
                onClick={signWithBinance}
                disabled={signing || Boolean(signedWallet)}
                className="button primary"
              >
                {signing
                  ? "Waiting for Binance Wallet..."
                  : signedWallet
                  ? "Audit Signed"
                  : "Sign Audit with Binance Wallet"}
              </button>

              <p style={{ fontSize: "12px", marginTop: "8px" }}>
                Auditor only. This signs a message;
                it does not send cryptocurrency.
              </p>
            </div>
          )}
        </div>
      )}

      {signedWallet && (
        <div
          role="status"
          style={{
            marginTop: "15px",
            color: "#17613f",
            overflowWrap: "anywhere"
          }}
        >
          <strong>Audit signature verified and saved.</strong>
          <p>Signing wallet: {signedWallet}</p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          style={{ color: "#b42318", marginTop: "16px" }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
