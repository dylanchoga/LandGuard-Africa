
import React, { useEffect, useState } from "react";

export default function BinanceWalletConnect() {
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    function detectWallet(event) {
      if (event.detail?.info?.rdns === "com.binance.wallet") {
        setProvider(event.detail.provider);
      }
    }

    window.addEventListener(
      "eip6963:announceProvider",
      detectWallet
    );

    window.dispatchEvent(
      new Event("eip6963:requestProvider")
    );

    return () => {
      window.removeEventListener(
        "eip6963:announceProvider",
        detectWallet
      );
    };
  }, []);

  async function connectWallet() {
    setError("");

    if (!provider) {
      setError("Binance Wallet not detected.");
      return;
    }

    try {
      const accounts = await provider.request({
        method: "eth_requestAccounts"
      });

      if (!accounts?.[0]) {
        throw new Error("No wallet address returned.");
      }

      setAddress(accounts[0]);
    } catch (err) {
      setError(err.message || "Wallet connection failed.");
    }
  }

  return (
    <section className="surfacePanel reviewPanel">
      <h3>Binance Wallet — Audit Verification</h3>
      <p>Connect your wallet to enable digital audit signatures.</p>

      <button
        className="button primary"
        onClick={connectWallet}
        disabled={!provider}
      >
        {address ? "Binance Wallet Connected" : "Connect Binance Wallet"}
      </button>

      {address && (
        <p style={{ overflowWrap: "anywhere" }}>
          Connected wallet: {address}
        </p>
      )}

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
