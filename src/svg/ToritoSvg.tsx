export default function ToritoSvg() {
  return (
    <div className="flex items-center gap-3">
      <img 
        src="/torito.jpeg" 
        alt="Torito" 
        className="h-20 w-20 rounded-full object-cover"
      />
      <span className="text-3xl font-bold text-gray-800">Torito</span>
    </div>
  );
}
