// Contoh draf untuk layout dashboard yang membungkus halaman operasional
import Sidebar from "@/components/Sidebar"; // Kita akan buat komponen ini nanti

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Background abu-abu sangat terang (khas aplikasi formal)
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-800">
      
      {/* Sidebar Navigasi Kiri */}
      <Sidebar />

      {/* Konten Utama di Kanan */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        
        {/* Opsional: Topbar/Header untuk Profil (Bisa ditaruh di sini nanti) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6 shadow-sm">
          <div className="text-sm font-medium text-slate-600">
            KPPN Lhokseumawe
          </div>
        </header>

        {/* Area Render Halaman (page.tsx) */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          {children}
        </main>

      </div>
    </div>
  );
}