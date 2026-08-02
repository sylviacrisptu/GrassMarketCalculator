export interface BuiltInIconEntry {
    id: string;
    name: string;
    filename: string;
    aliases: string[];
  }
  
  export interface CustomIconEntry {
    id: string;
    name: string;
    aliases: string[];
    dataUrl: string;
    createdAt: string;
  }
  
  export interface ResolvedItemIcon {
    id: string;
    name: string;
    url: string;
    custom: boolean;
  }