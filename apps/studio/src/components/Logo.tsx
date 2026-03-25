interface LogoProps {
	height?: number
	className?: string
}

/** Full BPMNkit brand logo from doc/logos/2026.svg, served from /logo.svg. */
export function BpmnkitLogo({ height = 32, className = "" }: LogoProps) {
	return (
		<img
			src="/logo.svg"
			height={height}
			width={height}
			alt="BPMNkit"
			className={className}
			style={{ display: "block" }}
		/>
	)
}
