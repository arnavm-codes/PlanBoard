const AVATAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-green-500",
  "bg-teal-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
];

function colorForUsername(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initialsForUsername(username: string): string {
  const cleaned = username.replace(/[^a-zA-Z0-9]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  username: string;
  size?: "sm" | "md";
  title?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "w-5 h-5 text-[10px]",
  md: "w-8 h-8 text-xs",
};

function Avatar({ username, size = "sm", title }: AvatarProps) {
  return (
    <div
      className={`rounded-full flex items-center justify-center font-medium text-white shrink-0 ${colorForUsername(
        username,
      )} ${SIZE_CLASSES[size]}`}
      title={title ?? username}
    >
      {initialsForUsername(username)}
    </div>
  );
}

export default Avatar;
