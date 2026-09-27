import type { Metadata } from "next";
import { Big_Shoulders, Big_Shoulders_Stencil, Geist_Mono, Libre_Franklin } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const franklin = Libre_Franklin({ variable: "--font-franklin", subsets: ["latin"] });
const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"] });
const stencil = Big_Shoulders_Stencil({ variable: "--font-stencil", subsets: ["latin"], weight: "800" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ShiftMate", template: "%s · ShiftMate" },
  description: "Staff scheduling for multi-location retail: weekly schedules, swaps, time off and labor cost.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${franklin.variable} ${display.variable} ${stencil.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
