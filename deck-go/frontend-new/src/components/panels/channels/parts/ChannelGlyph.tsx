export function ChannelGlyph(props: { id: string; label: string }) {
  const letters = props.label.slice(0, 2).toUpperCase();
  return (
    <span className="channels-glyph" data-channel={props.id} aria-hidden="true">
      {letters}
    </span>
  );
}
