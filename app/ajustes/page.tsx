import CalibrationSettings from "@/components/CalibrationSettings";
import DataSettings from "@/components/DataSettings";

export default function AjustesPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Ajustes</h1>
      <CalibrationSettings />
      <DataSettings />
    </div>
  );
}
