import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProspeccaoAtivaTab from "./ProspeccaoAtivaTab";
import LeadDatabasePanel from "./LeadDatabasePanel";

export default function ProspeccaoAtivaShell() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() =>
    searchParams.get("subtab") === "database" || searchParams.get("openUnit") ? "database" : "pipeline",
  );

  useEffect(() => {
    const sub = searchParams.get("subtab");
    if (sub === "database" || searchParams.get("openUnit")) setTab("database");
    else if (sub === "pipeline") setTab("pipeline");
  }, [searchParams]);

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-3">
      <TabsList className="h-auto bg-muted/40 p-1 gap-1 rounded-lg w-fit">
        <TabsTrigger
          value="pipeline"
          className="rounded-md px-3 py-1.5 text-[13px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Pipeline
        </TabsTrigger>
        <TabsTrigger
          value="database"
          className="rounded-md px-3 py-1.5 text-[13px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Base de Dados de Leads
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pipeline" className="mt-0 data-[state=inactive]:hidden" forceMount>
        <ProspeccaoAtivaTab />
      </TabsContent>

      <TabsContent value="database" className="mt-0 data-[state=inactive]:hidden">
        <LeadDatabasePanel />
      </TabsContent>
    </Tabs>
  );
}
