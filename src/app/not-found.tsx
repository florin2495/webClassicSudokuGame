export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold">Pagina nu există.</p>
      <a href="/classicsudoku" className="rounded-lg bg-white px-4 py-2 font-semibold text-green-900">
        Înapoi la joc
      </a>
    </main>
  );
}
