import { useState, useEffect } from "react";

export default function IntegrationsPage() {
  const [data, setData] = useState<any>(null);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations/facebook/pages")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        const defaultPage = json.pages?.find((p: any) => p.isDefault);
        if (defaultPage) setSelectedPageId(defaultPage.pageId);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    await fetch("/api/integrations/facebook/set-default-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: selectedPageId }),
    });
    alert("Página guardada");
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Integraciones</h1>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Facebook / Meta</h2>

        {!data.connected ? (
          <a
            href="/api/auth/facebook/start"
            className="inline-block bg-[#1877F2] text-white px-4 py-2 rounded-lg hover:bg-[#166FE5]"
          >
            Conectar con Facebook
          </a>
        ) : (
          <>
            <p className="text-sm text-green-600 mb-4">✓ Conectado</p>

            {data.pages?.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Selecciona la página activa:
                </label>
                {data.pages.map((page: any) => (
                  <label key={page.pageId} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="page"
                      value={page.pageId}
                      checked={selectedPageId === page.pageId}
                      onChange={(e) => setSelectedPageId(e.target.value)}
                      className="text-[#6C63FF]"
                    />
                    <span className="text-sm">{page.pageName}</span>
                  </label>
                ))}
                <button
                  onClick={handleSave}
                  className="mt-4 bg-[#6C63FF] text-white px-4 py-2 rounded-lg hover:bg-[#5950ff]"
                >
                  Guardar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
