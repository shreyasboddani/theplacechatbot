import {
  LearnAILogo,
  ThePlaceLogo,
} from "@/components/branding/BrandLogos";
import { ArrowIcon, ShieldIcon } from "@/components/chatbot/Icons";
import { ChatWidget } from "@/components/chatbot/ChatWidget";

const serviceCards = [
  {
    number: "01",
    title: "Find support",
    body: "Ask about food, financial assistance, senior support, and other available information.",
  },
  {
    number: "02",
    title: "Give with purpose",
    body: "Find official guidance for food donations, thrift store donations, and community drives.",
  },
  {
    number: "03",
    title: "Get involved",
    body: "Learn where to begin with volunteering, group service, and community service questions.",
  },
] as const;

export default function Home() {
  return (
    <main className="demo-page">
      <header className="demo-header">
        <a href="#top" className="demo-brand" aria-label="The Place assistant prototype home">
          <ThePlaceLogo className="demo-place-logo" priority />
          <span className="brand-product-name">Information Assistant</span>
        </a>
        <nav aria-label="Prototype navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#integration">Integration</a>
          <a
            className="header-contact"
            href="https://www.theplacega.org/contact-us"
            target="_blank"
            rel="noreferrer noopener"
          >
            Contact The Place <ArrowIcon size={16} />
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-text">
          <p className="eyebrow eyebrow-credit">
            <LearnAILogo className="eyebrow-credit-logo" decorative />
            Technology prototype by LearnAI
          </p>
          <h1>
            A clearer path to
            <span> trusted information.</span>
          </h1>
          <p className="hero-lede">
            The Place Information Assistant helps visitors navigate approved
            service, donation, and volunteer information with official sources
            attached to every supported answer.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#assistant-preview">
              Explore the assistant <ArrowIcon />
            </a>
            <a className="secondary-action" href="#how-it-works">
              See how grounding works
            </a>
          </div>
          <div className="trust-line">
            <ShieldIcon />
            <span>
              Answers come only from approved information from The Place.
            </span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Assistant overview">
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="hero-card">
            <div className="hero-card-top">
              <span className="hero-card-brand">
                <ThePlaceLogo className="hero-card-logo" decorative />
              </span>
              <span className="live-pill"><i /> Grounded answers</span>
            </div>
            <p className="hero-card-kicker">ONE TRUSTED PLACE TO START</p>
            <h2>Ask naturally. Verify easily.</h2>
            <p>
              Visitors get a concise response, a direct link to the supporting
              official page when available, and a clear contact path when the
              approved information is incomplete.
            </p>
            <div className="hero-card-tags" aria-label="Example topics">
              <span>Food support</span>
              <span>Financial assistance</span>
              <span>Donations</span>
              <span>Volunteering</span>
            </div>
          </div>
          <div className="source-proof-card">
            <ShieldIcon size={20} />
            <span><strong>Source required</strong><small>No unsupported answer is shown</small></span>
          </div>
        </div>
      </section>

      <section className="context-section" id="assistant-preview">
        <div className="section-heading">
          <p className="eyebrow"><span /> Standalone demonstration</p>
          <h2>A welcoming layer for an existing community website.</h2>
          <p>
            This sample content shows how the floating assistant sits alongside
            a normal public-service page without replacing its navigation or
            content.
          </p>
        </div>
        <div className="service-grid">
          {serviceCards.map((card) => (
            <article key={card.number} className="service-card">
              <span className="service-number">{card.number}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <span className="service-link">Ask the assistant <ArrowIcon size={17} /></span>
            </article>
          ))}
        </div>
      </section>

      <section className="grounding-section" id="how-it-works">
        <div className="grounding-copy">
          <p className="eyebrow light"><span /> Designed for careful answers</p>
          <h2>Helpful when the source is clear. Honest when it is not.</h2>
          <p>
            The runtime searches only a prepared Gemini File Search store. It
            does not browse the web during visitor conversations, and it does
            not use general model knowledge to fill gaps in organization policy.
          </p>
        </div>
        <ol className="grounding-steps">
          <li><span>1</span><div><strong>Ask a question</strong><p>Visitors use everyday language.</p></div></li>
          <li><span>2</span><div><strong>Search approved material</strong><p>Only synced website and staff content is eligible.</p></div></li>
          <li><span>3</span><div><strong>Show proof or a contact path</strong><p>Mapped sources are required for a substantive answer.</p></div></li>
        </ol>
      </section>

      <section className="integration-section" id="integration">
        <div>
          <p className="eyebrow"><span /> Framework-independent integration</p>
          <h2>One script tag, isolated from the host site.</h2>
          <p>
            The loader creates its own floating control and secure iframe, so a
            website manager can test it on WordPress, Squarespace, or a custom
            site without adding React.
          </p>
        </div>
        <pre aria-label="Widget integration example"><code>{`<script
  async
  src="https://theplacechatbot.vercel.app/widget-loader.js"
  data-chatbot-url="https://theplacechatbot.vercel.app/embed"
  data-position="bottom-right"
  data-label="Ask The Place">
</script>`}</code></pre>
      </section>

      <footer className="demo-footer">
        <div className="footer-place-brand">
          <span className="footer-place-logo-wrap">
            <ThePlaceLogo className="footer-place-logo" />
          </span>
          <span>Information Assistant</span>
        </div>
        <div className="footer-meta">
          <div className="learnai-credit">
            <LearnAILogo className="learnai-credit-logo" decorative />
            <span>Prototype technology by <strong>LearnAI</strong></span>
          </div>
          <p>
            This demonstration is not a case-management service and is not a
            final production deployment.
          </p>
        </div>
      </footer>

      <ChatWidget />
    </main>
  );
}
