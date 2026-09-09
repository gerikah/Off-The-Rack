import { Button } from "@/components/ui";
export default function NotFound() {
  return (
    <section className="section-wrap not-found">
      <span className="eyebrow">404 / OFF THE RACK</span>
      <h1 className="display">
        THIS RACK
        <br />
        IS EMPTY.
      </h1>
      <p>The page you’re looking for isn’t here. Your next piece might be.</p>
      <Button href="/shop">Explore the collection</Button>
    </section>
  );
}
