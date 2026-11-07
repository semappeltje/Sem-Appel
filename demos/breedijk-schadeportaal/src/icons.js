// Iconen uit Lucide (ISC, https://lucide.dev), statisch gebundeld: alleen de iconen die de app gebruikt. Decoratief
// (aria-hidden); de tekst ernaast zegt wat het is.
import { House, Inbox, FileText, Users, Building2, ChartColumn, Settings, Search, Plus, Sun, Moon, Check, X, TriangleAlert, Info, Clock, Camera, Paperclip, Mail, Car, ChevronRight, ChevronDown, ArrowUp, ArrowLeft, Ellipsis, Copy, Printer, Download, Lock, Send, User, Truck, Flag, Link, Shield, Eye, Menu, PanelLeft, Euro, MapPin, Sparkles, RefreshCw, Wrench, Phone, Calendar, List, LayoutGrid, Trash2, Save, IdCard, Minus } from 'lucide';
const MAP = { home: House, inbox: Inbox, file: FileText, users: Users, building: Building2, chart: ChartColumn, settings: Settings, search: Search, plus: Plus, sun: Sun, moon: Moon, check: Check, x: X, alert: TriangleAlert, info: Info, clock: Clock, camera: Camera, clip: Paperclip, mail: Mail, car: Car, chev: ChevronRight, chevd: ChevronDown, up: ArrowUp, back: ArrowLeft, more: Ellipsis, copy: Copy, print: Printer, download: Download, lock: Lock, send: Send, user: User, truck: Truck, flag: Flag, link: Link, shield: Shield, eye: Eye, menu: Menu, panel: PanelLeft, euro: Euro, pin: MapPin, sparkle: Sparkles, refresh: RefreshCw, wrench: Wrench, phone: Phone, cal: Calendar, list: List, grid: LayoutGrid, trash: Trash2, save: Save, idcard: IdCard, minus: Minus };
const attrs = o => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
const cache = new Map();
export const ico = (n, cls = '') => {
  const key = n + '|' + cls; if (cache.has(key)) return cache.get(key);
  const node = MAP[n] || Info;
  const s = `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${node.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('')}</svg>`;
  cache.set(key, s); return s;
};
