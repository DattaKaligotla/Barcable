import { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Store,
  Plus,
  Search,
  Tag,
  Star,
  Copy,
  ExternalLink,
  Trash2,
} from "lucide-react";

interface PromptStoreManagerProps {
  projectId: string;
}

interface StoredPrompt {
  id: string;
  name: string;
  content: string;
  labels: string[];
  version: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  author: string;
}

export function PromptStoreManager({
  projectId: _projectId,
}: PromptStoreManagerProps) {
  const [storedPrompts, setStoredPrompts] = useState<StoredPrompt[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLabel, setFilterLabel] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<StoredPrompt | null>(
    null,
  );

  // New prompt form state
  const [newPrompt, setNewPrompt] = useState({
    name: "",
    content: "",
    labels: "",
    isPublic: false,
  });

  // Mock data - replace with actual API calls
  useEffect(() => {
    const mockPrompts: StoredPrompt[] = [
      {
        id: "1",
        name: "Customer Support Classifier",
        content:
          "Classify the following customer inquiry into one of these categories: billing, technical, general. Inquiry: {input}",
        labels: ["classification", "customer-support", "production"],
        version: 3,
        rating: 4.8,
        createdAt: "2024-01-15",
        updatedAt: "2024-01-20",
        isPublic: true,
        author: "team@company.com",
      },
      {
        id: "2",
        name: "Code Review Assistant",
        content:
          "Review the following code for best practices, potential bugs, and security issues. Provide constructive feedback: {code}",
        labels: ["code-review", "development", "qa"],
        version: 1,
        rating: 4.5,
        createdAt: "2024-01-18",
        updatedAt: "2024-01-18",
        isPublic: false,
        author: "dev@company.com",
      },
      {
        id: "3",
        name: "Email Tone Analyzer",
        content:
          "Analyze the tone of this email and suggest improvements for professionalism: {email_content}",
        labels: ["tone-analysis", "communication", "hr"],
        version: 2,
        rating: 4.2,
        createdAt: "2024-01-10",
        updatedAt: "2024-01-16",
        isPublic: true,
        author: "hr@company.com",
      },
    ];
    setStoredPrompts(mockPrompts);
  }, []);

  const allLabels = Array.from(new Set(storedPrompts.flatMap((p) => p.labels)));

  const filteredPrompts = storedPrompts.filter((prompt) => {
    const matchesSearch =
      prompt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.labels.some((label) =>
        label.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesLabel =
      filterLabel === "all" || prompt.labels.includes(filterLabel);

    return matchesSearch && matchesLabel;
  });

  const handleAddPrompt = () => {
    const prompt: StoredPrompt = {
      id: Date.now().toString(),
      name: newPrompt.name,
      content: newPrompt.content,
      labels: newPrompt.labels
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l),
      version: 1,
      rating: 0,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
      isPublic: newPrompt.isPublic,
      author: "current@user.com",
    };

    setStoredPrompts([...storedPrompts, prompt]);
    setNewPrompt({ name: "", content: "", labels: "", isPublic: false });
    setIsAddDialogOpen(false);
  };

  const handleCopyPrompt = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleDeletePrompt = (id: string) => {
    setStoredPrompts(storedPrompts.filter((p) => p.id !== id));
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Prompt Store Manager
          </CardTitle>
          <CardDescription>
            Manage, organize, and discover high-performing prompts in your store
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterLabel} onValueChange={setFilterLabel}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Labels</SelectItem>
                {allLabels.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Prompt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Prompt to Store</DialogTitle>
                  <DialogDescription>
                    Create a new prompt entry in your store for reuse and
                    sharing
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Prompt Name</Label>
                    <Input
                      id="name"
                      value={newPrompt.name}
                      onChange={(e) =>
                        setNewPrompt({ ...newPrompt, name: e.target.value })
                      }
                      placeholder="e.g., Customer Email Classifier"
                    />
                  </div>
                  <div>
                    <Label htmlFor="content">Prompt Content</Label>
                    <Textarea
                      id="content"
                      value={newPrompt.content}
                      onChange={(e) =>
                        setNewPrompt({ ...newPrompt, content: e.target.value })
                      }
                      placeholder="Enter your prompt template here..."
                      rows={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="labels">Labels (comma-separated)</Label>
                    <Input
                      id="labels"
                      value={newPrompt.labels}
                      onChange={(e) =>
                        setNewPrompt({ ...newPrompt, labels: e.target.value })
                      }
                      placeholder="e.g., classification, email, customer-service"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={newPrompt.isPublic}
                      onChange={(e) =>
                        setNewPrompt({
                          ...newPrompt,
                          isPublic: e.target.checked,
                        })
                      }
                    />
                    <Label htmlFor="isPublic">Make this prompt public</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddPrompt}
                      disabled={!newPrompt.name || !newPrompt.content}
                    >
                      Add to Store
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="text-sm text-muted-foreground">
            {filteredPrompts.length} of {storedPrompts.length} prompts
          </div>
        </CardContent>
      </Card>

      {/* Prompt List */}
      <div className="grid gap-4">
        {filteredPrompts.map((prompt) => (
          <Card key={prompt.id} className="transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{prompt.name}</h3>
                    <Badge variant="outline">v{prompt.version}</Badge>
                    {prompt.isPublic && (
                      <Badge variant="secondary">Public</Badge>
                    )}
                  </div>
                  <div className="mb-3 flex items-center gap-4 text-sm text-muted-foreground">
                    <span>by {prompt.author}</span>
                    <span>Updated {prompt.updatedAt}</span>
                    <div className="flex items-center gap-1">
                      {getRatingStars(prompt.rating)}
                      <span>({prompt.rating})</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyPrompt(prompt.content)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPrompt(prompt)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePrompt(prompt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mb-4 rounded-lg bg-muted p-3 font-mono text-sm">
                {prompt.content.slice(0, 200)}
                {prompt.content.length > 200 && "..."}
              </div>

              <div className="flex flex-wrap gap-1">
                {prompt.labels.map((label) => (
                  <Badge key={label} variant="outline" className="text-xs">
                    <Tag className="mr-1 h-3 w-3" />
                    {label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPrompts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              {searchTerm || filterLabel !== "all"
                ? "No prompts match your search criteria"
                : "No prompts in store yet"}
            </div>
            {!searchTerm && filterLabel === "all" && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Prompt
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prompt Detail Dialog */}
      {selectedPrompt && (
        <Dialog
          open={!!selectedPrompt}
          onOpenChange={() => setSelectedPrompt(null)}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedPrompt.name}
                <Badge variant="outline">v{selectedPrompt.version}</Badge>
              </DialogTitle>
              <DialogDescription>
                Created {selectedPrompt.createdAt} • Last updated{" "}
                {selectedPrompt.updatedAt}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Prompt Content</Label>
                <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
                  {selectedPrompt.content}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Label>Rating:</Label>
                  {getRatingStars(selectedPrompt.rating)}
                  <span>({selectedPrompt.rating})</span>
                </div>
                <div className="flex items-center gap-1">
                  <Label>Author:</Label>
                  <span>{selectedPrompt.author}</span>
                </div>
              </div>
              <div>
                <Label>Labels</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedPrompt.labels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleCopyPrompt(selectedPrompt.content)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Content
                </Button>
                <Button onClick={() => setSelectedPrompt(null)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
