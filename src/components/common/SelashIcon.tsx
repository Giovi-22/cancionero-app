import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, SvgProps } from 'react-native-svg';

// Extendemos las propiedades estándar de SVG para permitir configurar márgenes o estilos externos
interface SelahIconProps extends SvgProps {
    size?: number;
}

export default function SelahIcon({ size = 150, ...props }: SelahIconProps): React.JSX.Element {
    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 200 200"
            fill="none"
            {...props}
        >
            <Defs>
                {/* Degradado violeta neón para el trazo principal */}
                <LinearGradient id="violetNeon" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                    <Stop offset="50%" stopColor="#8b5cf6" stopOpacity={1} />
                    <Stop offset="100%" stopColor="#6366f1" stopOpacity={1} />
                </LinearGradient>
            </Defs>

            {/* Trazo fluido entrelazado en forma de S / Infinito musical */}
            <Path
                d="M100,50 
           C125,50 145,68 135,95 
           C125,120 75,110 65,135 
           C55,162 75,180 100,180 
           C130,180 145,150 155,135 
           M100,50 
           C75,50 55,68 65,95 
           C75,120 125,110 135,135 
           C145,162 125,180 100,180"
                stroke="url(#violetNeon)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Detalle del corte lineal superior diagonal */}
            <Path
                d="M135,95 L155,65"
                stroke="#c084fc"
                strokeWidth="5"
                strokeLinecap="round"
            />
        </Svg>
    );
}
