export function Progress({ value }: { value: number }) { return <div className="ui-progress" aria-label="progress"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }
