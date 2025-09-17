import React, { useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  Search,
  Filter,
  Tag,
  Clock,
  GitBranch,
  Rocket,
  Eye,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { api } from "@/src/utils/api";
import { formatDistanceToNow } from "date-fns";

export const PromptStoreBrowser: React.FC = () => {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  const [searchName, setSearchName] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [searchTags, setSearchTags] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  // API queries
  const labelsOverview = api.promptStore.getLabelsOverview.useQuery(undefined, {
    enabled: !!projectId,
  });

  const browseStore = api.promptStore.browseStore.useQuery(
    {
      name: searchName || undefined,
      label: selectedLabel || undefined,
      tags: searchTags ? searchTags.split(",").map((t) => t.trim()) : undefined,
      limit,
      offset,
    },
    {
      enabled: !!projectId,
      placeholderData: (previousData) => previousData,
    },
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

  const handleSearch = () => {
    setOffset(0);
    browseStore.refetch();
  };

  const handleClearFilters = () => {
    setSearchName("");
    setSelectedLabel("");
    setSearchTags("");
    setOffset(0);
  };

  const navigateToPrompt = (promptId: string) => {
    router.push(`/project/${projectId}/prompts/${promptId}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Prompt Store Browser
        </CardTitle>
        <CardDescription>
          Browse and search prompts in your store. Filter by labels, names, and
          tags.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search and Filters */}
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-muted/50 p-4 md:grid-cols-4">
          <div>
            <Label htmlFor="search-name">Prompt Name</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-name"
                placeholder="Search by name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="pl-9"
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>

          <div>
            <Label>Label Filter</Label>
            <Select value={selectedLabel} onValueChange={setSelectedLabel}>
              <SelectTrigger>
                <SelectValue placeholder="All labels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All labels</SelectItem>
                {labelsOverview.data &&
                  Object.keys(labelsOverview.data.labelCounts).map((label) => (
                    <SelectItem key={label} value={label}>
                      {label} ({labelsOverview.data.labelCounts[label]})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="search-tags">Tags</Label>
            <Input
              id="search-tags"
              placeholder="tag1, tag2..."
              value={searchTags}
              onChange={(e) => setSearchTags(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={handleSearch} className="flex-1">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => browseStore.refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Label Overview */}
        {labelsOverview.data && (
          <div>
            <Label className="text-sm font-medium">Quick Filter by Label</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant={selectedLabel === "" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedLabel("");
                  setOffset(0);
                }}
              >
                All ({labelsOverview.data.totalPrompts})
              </Button>
              {Object.entries(labelsOverview.data.labelCounts).map(
                ([label, count]) => (
                  <Button
                    key={label}
                    variant={selectedLabel === label ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedLabel(label);
                      setOffset(0);
                    }}
                    className="flex items-center gap-1"
                  >
                    {getLabelIcon(label)}
                    {label} ({count})
                  </Button>
                ),
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {browseStore.isLoading ? (
          <div className="py-8 text-center">
            <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin" />
            <p>Loading prompts...</p>
          </div>
        ) : browseStore.data && browseStore.data.prompts.length > 0 ? (
          <div className="space-y-4">
            {/* Results Info */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {browseStore.data.prompts.length} of{" "}
                {browseStore.data.totalCount} prompts
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= browseStore.data.totalCount}
                >
                  Next
                </Button>
              </div>
            </div>

            {/* Results Table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Labels</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {browseStore.data.prompts.map((prompt) => (
                    <TableRow key={prompt.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold">{prompt.name}</p>
                          {prompt.tags && prompt.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {prompt.tags.slice(0, 3).map((tag: string) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {prompt.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{prompt.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">v{prompt.version}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {prompt.labels.slice(0, 3).map((label: string) => (
                            <Badge
                              key={label}
                              variant={getLabelVariant(label)}
                              className="flex items-center gap-1 text-xs"
                            >
                              {getLabelIcon(label)}
                              {label}
                            </Badge>
                          ))}
                          {prompt.labels.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{prompt.labels.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(prompt.updatedAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigateToPrompt(prompt.id)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <Tag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No prompts found</h3>
            <p className="text-muted-foreground">
              {searchName || selectedLabel || searchTags
                ? "Try adjusting your search filters"
                : "No prompts have been published to the store yet"}
            </p>
          </div>
        )}

        {/* Summary by Label */}
        {browseStore.data &&
          Object.keys(browseStore.data.groupedByLabel).length > 0 && (
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Results by Label</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(browseStore.data.groupedByLabel).map(
                  ([label, count]) => (
                    <Badge
                      key={label}
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      {getLabelIcon(label)}
                      {label}: {count}
                    </Badge>
                  ),
                )}
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
};
