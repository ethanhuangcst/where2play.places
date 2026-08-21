import Link from "next/link";

type Props = {
  href?: string;
  size?: 40 | 72;
  className?: string;
};

function PlaneMark({ size }: { size: number }) {
  return (
    <span className="mark-host mark-host--plane">
      <svg className="wing-trail" viewBox="0 0 18 10" fill="none" aria-hidden="true">
        <path d="M17 2.2c-3.2.9-6.5 2.2-10 3.6C4.2 6.8 2.2 7.6 1 8.2" />
      </svg>
      <img className="mark mark--plane" src="/play-logo.png" alt="" width={size} height={size} />
    </span>
  );
}

export function LogoLink({ href = "/", size = 40, className = "logo" }: Props) {
  const inner = (
    <>
      <PlaneMark size={size} />
      <span className="logo-word">where2play.place</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-label="where2play.place">
        {inner}
      </Link>
    );
  }
  return <span className={className}>{inner}</span>;
}
