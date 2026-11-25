import { Audiences } from "@/components/landing/audiences";
import { Benefits } from "@/components/landing/benefits";
import { BuySection } from "@/components/landing/buy-section";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Trust } from "@/components/landing/trust";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Benefits />
        <BuySection />
        <Audiences />
        <Trust />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
