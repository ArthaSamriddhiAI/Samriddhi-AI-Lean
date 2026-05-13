import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [setting, investors, snapshots, cases] = await Promise.all([
    prisma.setting.findUnique({ where: { id: 1 } }),
    prisma.investor.count(),
    prisma.snapshot.count(),
    prisma.case.count(),
  ]);

  const initial = setting ?? {
    id: 1,
    apiKey: null,
    modelChoice: "claude-opus-4-7",
    advisorName: "Priya Nair",
    firmName: "Anand Rathi Wealth · UHNI desk",
    updatedAt: new Date(),
  };

  return (
    <div className="settings-page">
      <div className="nc-eyebrow">Settings</div>
      <h1>Demo configuration</h1>
      <p className="sub">
        Utility surface for demo prep. The product itself is the workflow screens; this is the back-of-house.
      </p>
      <SettingsForm
        initialSetting={{
          apiKey: initial.apiKey,
          modelChoice: initial.modelChoice,
          advisorName: initial.advisorName,
          firmName: initial.firmName,
        }}
        initialCounts={{ investors, snapshots, cases }}
      />
    </div>
  );
}
