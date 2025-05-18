import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { SimulationProvider } from "@/context/simulation-context"

const inter = Inter({ subsets: ["latin"] })
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Le Pain du Mec - Disease Simulator",
  description: "A disease simulation application with interactive visualizations",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${playfair.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <SimulationProvider>{children}</SimulationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
