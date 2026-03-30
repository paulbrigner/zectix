export function EmbedBrandingFooter() {
  return (
    <footer className="embed-branding-footer">
      <p className="embed-branding-copy">
        Zcash payments powered by{" "}
        <a
          className="embed-branding-link"
          href="https://zectix.com"
          rel="noreferrer noopener"
          target="_blank"
        >
          ZecTix
        </a>{" "}
        and{" "}
        <a
          className="embed-branding-link"
          href="https://www.cipherpay.app/"
          rel="noreferrer noopener"
          target="_blank"
        >
          CipherPay
        </a>
        .
      </p>
    </footer>
  );
}
