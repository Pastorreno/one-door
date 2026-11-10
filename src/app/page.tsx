import OneDoorPanel from "./OneDoorPanel";
import { PRODUCT_NAME } from "../lib/one-door";

export default function Home() {
  return (
    <main className="od-home">
      <header className="od-home-head">
        <div className="od-wordmark">GGI Hub</div>
        <h1>{PRODUCT_NAME}</h1>
        <p>
          One link, everything about a person. A digital business card, a
          link hub, a musician press kit, or a one-page presence for a
          preacher without a website. Fill in the details, get a page you
          can share anywhere — with a QR code and a save-to-contacts button.
        </p>
      </header>
      <OneDoorPanel />
      <footer className="od-home-foot">
        <p>
          A <strong>GGI Hub</strong> product. Cards are yours: phone and
          email stay off a card unless you choose to show them.
        </p>
      </footer>
    </main>
  );
}
