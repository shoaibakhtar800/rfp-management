import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { FileText } from "lucide-react";
import { MainNav } from "~/components/layout/main-nav";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
  title: "AI-Powered RFP Management System",
  description: "Streamline your procurement process with AI-powered RFP management",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <div className="flex flex-col min-h-screen bg-background">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
            <div className="container mx-auto flex h-16 items-center px-4">
              <div className="mr-8">
                <Link href="/" className="flex items-center space-x-2">
                  <FileText className="h-6 w-6 text-primary" />
                  <span className="font-bold text-xl">RFP Manager</span>
                </Link>
              </div>
              <MainNav />
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center">
            <div className="container mx-auto px-4 py-6">
              {children}
            </div>
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
