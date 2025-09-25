import { useEffect } from "react";
import LandingPage from "@/pages/landing";

function App() {
  // Ensure the marketing site always renders in dark mode to match the neon aesthetic
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingPage />
    </div>
  );
}

export default App;
