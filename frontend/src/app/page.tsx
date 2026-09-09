import { Navbar } from "@/components/dashboard/Navbar";
import { PageTabs } from "@/components/dashboard/PageTabs";
import { ForecastSection } from "@/components/dashboard/ForecastSection";
import { RainChart } from "@/components/dashboard/RainChart";
import { GlobePanel } from "@/components/dashboard/GlobePanel";
import { CityListPanel } from "@/components/dashboard/CityListPanel";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { LocationProvider } from "@/lib/location-context";
import { ViewProvider } from "@/lib/view-context";
import { SearchProvider } from "@/lib/search-context";
import { AlertsProvider } from "@/lib/alerts-context";

const DEFAULT_LOCATION = { lat: 27.5045, lon: 77.6737, name: "Mathura, India" };

export default function Home() {
  return (
    <LocationProvider initialLocation={DEFAULT_LOCATION}>
      <ViewProvider>
        <SearchProvider>
          <AlertsProvider>
            <main className="flex flex-1 justify-center bg-bg-app p-4 sm:p-8">
              <div className="flex w-full max-w-[1200px] flex-col gap-6 rounded-xl bg-bg-shell p-3 sm:p-6">
                <Navbar />
                <AlertBanner />
                <PageTabs />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <ForecastSection />
                  </div>
                  <div className="lg:col-span-4">
                    <RainChart />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <GlobePanel />
                  </div>
                  <div className="lg:col-span-4">
                    <CityListPanel />
                  </div>
                </div>
              </div>
            </main>
            <ChatWidget />
          </AlertsProvider>
        </SearchProvider>
      </ViewProvider>
    </LocationProvider>
  );
}
