export type IniArrayOperator = '+' | '-' | '!' | null;

export interface IniRangeLike {
  start: number;
  end: number;
}

export interface IniBaseNode {
  kind: string;
  raw: string;
  line: number;
  startOffset: number;
  endOffset: number;
}

export interface IniSectionNode extends IniBaseNode {
  kind: 'section';
  name: string;
  nameRange: IniRangeLike;
}

export interface IniKeyValueNode extends IniBaseNode {
  kind: 'keyValue';
  section: string | null;
  operator: IniArrayOperator;
  key: string;
  value: string;
  keyRange: IniRangeLike;
  valueRange: IniRangeLike;
  inlineComment?: string;
}

export interface IniCommentNode extends IniBaseNode {
  kind: 'comment';
  text: string;
  marker: ';' | '#';
}

export interface IniBlankNode extends IniBaseNode {
  kind: 'blank';
}

export interface IniInvalidNode extends IniBaseNode {
  kind: 'invalid';
  reason: string;
}

export type IniNode =
  | IniSectionNode
  | IniKeyValueNode
  | IniCommentNode
  | IniBlankNode
  | IniInvalidNode;

export interface IniDocument {
  text: string;
  nodes: IniNode[];
  sections: IniSectionNode[];
  keyValues: IniKeyValueNode[];
  comments: IniCommentNode[];
  invalid: IniInvalidNode[];
}
