import { SONG_EXAMPLE_TEXT } from './songTemplate';

export interface HelpBlockParagraph {
  type: 'paragraph';
  text: string;
}

export interface HelpBlockSteps {
  type: 'steps';
  items: string[];
}

export interface HelpBlockBullets {
  type: 'bullets';
  items: string[];
}

export interface HelpBlockCode {
  type: 'code';
  code: string;
  caption?: string;
}

export interface HelpBlockTable {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface HelpBlockNote {
  type: 'note';
  text: string;
}

export interface HelpBlockFaqItem {
  question: string;
  answer: string;
}

export interface HelpBlockFaq {
  type: 'faq';
  items: HelpBlockFaqItem[];
}

export type HelpBlock =
  | HelpBlockParagraph
  | HelpBlockSteps
  | HelpBlockBullets
  | HelpBlockCode
  | HelpBlockTable
  | HelpBlockNote
  | HelpBlockFaq;

export interface HelpSectionData {
  id: string;
  title: string;
  iconName?: string;
  blocks: HelpBlock[];
  hasTemplateActions?: boolean;
}

export const HELP_SECTIONS: HelpSectionData[] = [
  {
    id: 'get-started',
    title: 'Empezar en 4 pasos',
    iconName: 'Sparkles',
    blocks: [
      {
        type: 'steps',
        items: [
          'Creá una carpeta en tu Google Drive para guardar tus canciones.',
          'Guardá ahí tus canciones (podés descargar la plantilla lista desde la sección "Cómo crear una canción" más abajo).',
          'En la app, andá a la pestaña Usuario, iniciá sesión con tu cuenta de Google y elegí esa carpeta en "Carpeta de Canciones" tocando la lupa.',
          'Tocá el botón de sincronizar (el ícono de flechas en la barra superior o "Sincronizar ahora") y tus canciones aparecerán listas en la lista.',
        ],
      },
      {
        type: 'note',
        text: 'La app lee Google Docs, archivos .txt y archivos ChordPro (.cho, .pro, .chordpro) que estén en esa carpeta y en sus subcarpetas. Otros formatos como Word, PDF o imágenes no son leídos.',
      },
    ],
  },
  {
    id: 'create-song',
    title: 'Cómo crear una canción',
    iconName: 'FileEdit',
    hasTemplateActions: true,
    blocks: [
      {
        type: 'paragraph',
        text: 'Podés escribir tus canciones en un Google Doc o en un archivo .txt simple. Lo único que importa es respetar el formato para que la app entienda los acordes y la letra.',
      },
      {
        type: 'bullets',
        items: [
          'La primera línea del documento siempre es el título de la canción.',
          'Metadatos opcionales, uno por línea debajo del título: Intro:, Tono:, BPM:, Compás:, Nota:',
          'Las secciones van entre corchetes en su propia línea: [VERSO 1], [VERSO 2], [PRE-CORO], [CORO], [PUENTE], [INTERLUDIO], [INTRO], [OUTRO], [FINAL].',
          'Los acordes van en la línea de arriba, justo encima de la sílaba donde cambian, SIN líneas en blanco entre acordes y letra.',
          'Alineá siempre con la barra espaciadora, nunca uses tabulaciones. En Google Docs, usá una fuente monoespaciada (Courier New o Consolas) para que los acordes queden exactamente en su lugar.',
          'Para una línea de solo acordes (por ejemplo un solo instrumental), usá una sección como [INTERLUDIO] y poné los acordes en la línea siguiente.',
          'Si guardás un archivo .txt, asegurate de guardarlo con codificación UTF-8 para que las tildes y la ñ se lean correctamente.',
          'En la línea "Nota:", evitá escribir letras sueltas que sean nombres de acordes (por ejemplo una "A" o una "E" sola).',
        ],
      },
      {
        type: 'paragraph',
        text: 'Así se escribe el texto en tu documento o archivo .txt:',
      },
      {
        type: 'code',
        code: SONG_EXAMPLE_TEXT,
        caption: 'Ejemplo de canción en formato de texto',
      },
      {
        type: 'note',
        text: 'Así se ve en la app: los acordes se ubican automáticamente arriba de la letra, con su color asignado y listos para transponerse con un toque.',
      },
    ],
  },
  {
    id: 'app-features',
    title: 'Usar la app: canciones y repertorios',
    iconName: 'Music',
    blocks: [
      {
        type: 'bullets',
        items: [
          'Buscador y carpetas: filtrá por nombre desde la barra de búsqueda o navegá por las subcarpetas de tu Drive con el indicador superior.',
          'Abrir una canción: tocá cualquier tarjeta para abrir el visor con acordes y letra.',
          'Transponer y Capo: cambiá la tonalidad sumando o restando semitonos y configurá el traste del capo desde la barra superior del visor.',
          'Scroll automático: activá el desplazamiento manos libres y regulá la velocidad con los botones más y menos.',
          'Metrónomo: marcá el tempo visual y sonoro ajustando los BPM directamente en la barra del visor.',
          'Notas por canción: agregá notas e indicaciones específicas para cada tema dentro de un repertorio.',
          'Edición rápida: activá la herramienta de edición en el visor para retocar acordes o corregir letras al instante.',
          'Exportar a PDF: generá un archivo PDF limpio y listo para compartir o imprimir desde el menú del visor.',
          'Repertorios (Setlists): creá listas ordenadas para tus ensayos o eventos y organizá las canciones arrastrándolas desde el ícono de agarre.',
          'Reproductor (Player): tocá "Reproducir" en un repertorio para pasar de canción en canción a pantalla completa.',
        ],
      },
    ],
  },
  {
    id: 'bands-roles',
    title: 'Bandas y roles',
    iconName: 'Users',
    blocks: [
      {
        type: 'paragraph',
        text: 'En el modo Banda podés colaborar con tu grupo musical compartiendo repertorios y sincronizándolos en vivo. Cada integrante tiene un rol con permisos claros:',
      },
      {
        type: 'table',
        headers: ['Rol', 'Permisos y acciones'],
        rows: [
          [
            'Owner (Creador)',
            'Edita y elimina la banda. Invita miembros (como Miembro o Director), asigna o cambia roles, inicia y controla Director Mode, y gestiona todos los repertorios de la banda.',
          ],
          [
            'Director',
            'Inicia y controla Director Mode y gestiona los repertorios de la banda (crear, editar, ordenar). No edita datos de la banda ni administra miembros.',
          ],
          [
            'Miembro',
            'Consulta los repertorios de la banda y se conecta como seguidor en las sesiones de Director Mode.',
          ],
        ],
      },
    ],
  },
  {
    id: 'director-mode',
    title: 'Director Mode',
    iconName: 'Radio',
    blocks: [
      {
        type: 'paragraph',
        text: 'Director Mode sincroniza en tiempo real a toda la banda: quien dirige cambia de canción y se desplaza por la letra, y los demás lo ven automáticamente en su propia pantalla.',
      },
      {
        type: 'steps',
        items: [
          'Cómo iniciar: andá a la pestaña Banda → elegí un repertorio de la banda → tocá "Iniciar Director Mode". Requisitos: tener rol de Owner o Director, que el repertorio tenga al menos una canción, y que no haya otra sesión activa en la banda (solo se puede dirigir un repertorio a la vez).',
          'Si sos el Director: al cambiar de canción o desplazarte por la letra en el reproductor, todos los seguidores reciben el cambio al instante.',
          'Si sos seguidor: verás un banner "en vivo" con el botón "Volver" para ingresar a la sesión activa.',
          'Control de seguimiento: en el reproductor contás con el interruptor "Seguir al director". Activado ("Sincronización activa") sigue los cambios de canción y el scroll; desactivado ("Modo independiente") te permite navegar por tu cuenta. Al volver a activarlo, te sincronizás con la canción en la que esté el director.',
          'Finalizar sesión: el Director u Owner toca "Finalizar" en el banner superior y confirma en "Finalizar sesión". Todos los integrantes regresan al modo normal.',
        ],
      },
      {
        type: 'note',
        text: 'Requisito: todos los integrantes deben contar con conexión a internet (WiFi o datos móviles) para mantenerse sincronizados en tiempo real.',
      },
    ],
  },
  {
    id: 'pedal',
    title: 'Pedal',
    iconName: 'Footprints',
    blocks: [
      {
        type: 'paragraph',
        text: 'Podés conectar y configurar un pedal WiFi o Bluetooth desde Configuración → Pedal para controlar el scroll y cambiar de canción con los pies mientras tocás.',
      },
    ],
  },
  {
    id: 'faq',
    title: 'Problemas frecuentes',
    iconName: 'HelpCircle',
    blocks: [
      {
        type: 'faq',
        items: [
          {
            question: 'Mi canción no aparece en la lista',
            answer:
              'Comprobá que el archivo esté dentro de la carpeta seleccionada en Drive (o en una subcarpeta), que sea un Google Doc, .txt o archivo ChordPro, y volvé a tocar el botón de sincronizar.',
          },
          {
            question: 'Las tildes o la letra "ñ" se ven con caracteres raros',
            answer:
              'Si usás un archivo .txt, asegurate de guardarlo con codificación UTF-8 (es la opción por defecto en el Bloc de Notas o cualquier editor moderno).',
          },
          {
            question: 'Los acordes quedan desalineados respecto a la letra',
            answer:
              'Alineá siempre usando la barra espaciadora, nunca la tecla Tab. Si escribís en Google Docs, seleccioná todo el texto y poné una fuente monoespaciada (Courier New o Consolas).',
          },
          {
            question: 'La plantilla aparece como una canción más en mi lista',
            answer:
              'Es totalmente normal: la plantilla es un archivo de texto en tu carpeta de Drive. Podés editarla directamente en Drive con tu propia canción o renombrarla.',
          },
          {
            question: 'Director Mode no me sincroniza con la banda',
            answer:
              'Revisá que tengas conexión a internet activa y que el interruptor "Seguir al director" esté encendido en el reproductor.',
          },
        ],
      },
    ],
  },
];
