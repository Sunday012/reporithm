import Image from "next/image";
import Link from "next/link";
import { Code2 } from "lucide-react";
import ModeToggle from "@/components/ModeToggle";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/8 bg-[#f6f7f2]/85 px-5 backdrop-blur-xl dark:border-white/10 dark:bg-[#10120e]/85 sm:px-8">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Reporithm home">
          <Image
            src="/reporithm-mark.png"
            alt=""
            width={36}
            height={36}
            priority
            className="rounded-xl"
          />
          <span className="text-lg font-semibold tracking-[-0.035em]">Reporithm</span>
        </Link>

        <div className="flex items-center gap-2">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white sm:flex">
            <Code2 className="h-4 w-4" /> GitHub
          </a>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
