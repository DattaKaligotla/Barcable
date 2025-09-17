import React from "react";
import { useRouter } from "next/router";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Timeline,
  TimelineContent,
  TimelineDescription,
  TimelineHeader,
  TimelineIcon,
  TimelineItem,
  TimelineTitle,
} from "@/src/components/ui/timeline";
import {
  Clock,
  GitCommit,
  Tag,
  User,
  GitBranch,
  Rocket,
  Eye,
} from "lucide-react";
import { api } from "@/src/utils/api";
import { formatDistanceToNow, format } from "date-fns";

interface PromptHistoryViewerProps {
  promptName: string;
}

export const PromptHistoryViewer: React.FC<PromptHistoryViewerProps> = ({
  promptName,
}) => {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  const promptHistory = api.promptStore.getPromptHistory.useQuery(
    { promptName },
    { enabled: !!projectId && !!promptName },
  );

  const getLabelVariant = (label: string) => {
    if (label === "production") return "default";
    if (label === "staging") return "secondary";
    if (label.startsWith("candidate/")) return "outline";
    if (label === "deprecated") return "destructive";
    return "secondary";
  };

  const getLabelIcon = (label: string) => {
    if (label === "production") return <Rocket className="h-3 w-3" />;
    if (label === "staging") return <GitBranch className="h-3 w-3" />;
    if (label.startsWith("candidate/")) return <Eye className="h-3 w-3" />;
    if (label === "latest") return <Clock className="h-3 w-3" />;
    return <Tag className="h-3 w-3" />;
  };

  const getTimelineIcon = (labels: string[]) => {
    if (labels.includes("production")) return <Rocket className="h-4 w-4" />;
    if (labels.includes("staging")) return <GitBranch className="h-4 w-4" />;
    if (labels.some((l) => l.startsWith("candidate/")))
      return <Eye className="h-4 w-4" />;
    return <GitCommit className="h-4 w-4" />;
  };

  if (promptHistory.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Loading History...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (promptHistory.error || !promptHistory.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Prompt History
          </CardTitle>
          <CardDescription>
            Unable to load history for {promptName}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Prompt History
        </CardTitle>
        <CardDescription>
          Version and label history for {promptName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {promptHistory.data.timeline.length > 0 ? (
          <Timeline>
            {promptHistory.data.timeline.map((entry, index) => (
              <TimelineItem key={`${entry.version}-${index}`}>
                <TimelineIcon>{getTimelineIcon(entry.labels)}</TimelineIcon>
                <TimelineContent>
                  <TimelineHeader>
                    <TimelineTitle className="flex items-center gap-2">
                      <Badge variant="secondary">v{entry.version}</Badge>
                      {entry.commitMessage}
                    </TimelineTitle>
                    <TimelineDescription className="flex items-center gap-2 text-sm">
                      <User className="h-3 w-3" />
                      {entry.changedBy}
                      <Clock className="ml-4 h-3 w-3" />
                      {formatDistanceToNow(new Date(entry.timestamp), {
                        addSuffix: true,
                      })}
                      <span className="ml-2 text-xs text-muted-foreground">
                        (
                        {format(
                          new Date(entry.timestamp),
                          "MMM d, yyyy 'at' h:mm a",
                        )}
                        )
                      </span>
                    </TimelineDescription>
                  </TimelineHeader>

                  {entry.labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.labels.map((label) => (
                        <Badge
                          key={label}
                          variant={getLabelVariant(label)}
                          className="flex items-center gap-1 text-xs"
                        >
                          {getLabelIcon(label)}
                          {label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        ) : (
          <div className="py-8 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No History Available</h3>
            <p className="text-muted-foreground">
              No version history found for this prompt.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
