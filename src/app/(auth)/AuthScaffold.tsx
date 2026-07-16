import React from "react";

/**
 * Full-screen responsive shell for the auth pages (login / signup / onboarding).
 * Mobile: green hero band on top, white form panel below.
 * Desktop (lg+): 50/50 split — green brand panel left, form panel right.
 */
export default function AuthScaffold({
  heroTitle,
  children,
}: {
  heroTitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-primary-500">
      {/* Brand / hero panel */}
      <section className="relative overflow-hidden flex items-center justify-center shrink-0 h-[36vh] min-h-[220px] lg:h-auto lg:min-h-screen lg:w-1/2 lg:shrink">
        <h2 className="text-white text-center font-semibold leading-snug px-6 text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">
          {heroTitle}
        </h2>
        {/* signature soft circles — the brand element, scaled up on desktop */}
        <div className="absolute rounded-full bg-primary-50 -bottom-16 -left-16 w-32 h-32 lg:w-56 lg:h-56" />
        <div className="absolute rounded-full bg-primary-50 -top-16 -right-16 w-32 h-32 lg:w-56 lg:h-56" />
      </section>

      {/* Form panel */}
      <section className="flex-1 lg:w-1/2 bg-white rounded-t-3xl lg:rounded-none -mt-6 lg:mt-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] lg:shadow-none flex flex-col items-center px-6 pt-8 pb-8 lg:px-12">
        <div className="w-full max-w-[400px] flex flex-1 flex-col lg:flex-none lg:my-auto">
          {children}
        </div>
      </section>
    </div>
  );
}
