type PrintEvent = {
  name: string;
  date: string;
  institutionName?: string;
  institutionAddress?: string;
  venue?: string;
  logoUrl?: string | null;
};

export function PrintHeader({ event }: { event: PrintEvent | null }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const logoSrc = event?.logoUrl ? `${basePath}${event.logoUrl}` : `${basePath}/favicon.ico`;
  // next/image needs a plain <img> here: uploaded logos are not known at build time
  return (
    // <div className="w-full flex flex-col items-center mb-8 print:mb-4">
    <div className="w-full flex flex-col mb-8 print:mb-4">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="Logo" width={72} height={72} className="rounded object-contain" />
        {/* <div className="flex flex-col items-center"> */}
        <div className="flex flex-col">
          <span className="text-lg font-bold">{event?.institutionName || "Institution Name"}</span>
          {event?.institutionAddress && (
            <span className="text-base font-semibold">{event.institutionAddress}</span>
          )}
          {event?.venue && (
            <span className="text-base font-normal">{event.venue}</span>
          )}
        </div>
      </div>
      {event && (
        <div className="mt-3 text-center">
          <div className="text-xl font-bold text-primary leading-tight">{event.name}</div>
          <div className="text-sm text-muted-foreground font-normal mt-0.5">
            {new Date(event.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      )}
    </div>
  );
}