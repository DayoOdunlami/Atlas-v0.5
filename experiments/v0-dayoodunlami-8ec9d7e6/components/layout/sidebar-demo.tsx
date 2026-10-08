"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SidebarOption1 } from "./sidebar-option-1"
import { SidebarOption2 } from "./sidebar-option-2"
import { SidebarOption3 } from "./sidebar-option-3"

export function SidebarDemo() {
  const [selectedOption, setSelectedOption] = useState("option1")

  const options = [
    {
      id: "option1",
      title: "Option 1: Clean & Minimal",
      description: "Simple hover expansion with smooth transitions and clean typography",
      features: [
        "16px collapsed width with icons only",
        "264px expanded width on hover",
        "Smooth 300ms transitions",
        "Visual expansion indicator",
        "Clean section grouping",
      ],
    },
    {
      id: "option2",
      title: "Option 2: Premium & Polished",
      description: "Enhanced design with backdrop blur, staggered animations, and premium feel",
      features: [
        "14px collapsed width for maximum space",
        "288px expanded width with brand header",
        "Backdrop blur and shadow effects",
        "Staggered item animations",
        "Active state indicators",
        "Gradient expansion hints",
      ],
    },
    {
      id: "option3",
      title: "Option 3: Card-Based Modern",
      description: "Floating card design with gradient accents and modern aesthetics",
      features: [
        "20px collapsed width with floating card",
        "320px expanded width for spacious feel",
        "Floating card container with shadows",
        "Gradient backgrounds and accents",
        "Section progress indicators",
        "Modern rounded design language",
      ],
    },
  ]

  const renderSidebar = () => {
    switch (selectedOption) {
      case "option1":
        return <SidebarOption1 />
      case "option2":
        return <SidebarOption2 />
      case "option3":
        return <SidebarOption3 />
      default:
        return <SidebarOption1 />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Sidebar Navigation Options</h1>
          <p className="text-muted-foreground">
            Choose from three different hover-expandable sidebar designs. Each option provides unique aesthetics and
            user experience patterns.
          </p>
        </div>

        <Tabs value={selectedOption} onValueChange={setSelectedOption} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="option1">Clean & Minimal</TabsTrigger>
            <TabsTrigger value="option2">Premium & Polished</TabsTrigger>
            <TabsTrigger value="option3">Card-Based Modern</TabsTrigger>
          </TabsList>

          {options.map((option) => (
            <TabsContent key={option.id} value={option.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{option.title}</CardTitle>
                  <CardDescription>{option.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Key Features:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {option.features.map((feature, index) => (
                          <li key={index}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Live Preview */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>
                Hover over the sidebar to see the expansion behavior. The preview shows the selected option in action.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-muted/20 min-h-[600px] relative">
                <div className="flex h-full">
                  {renderSidebar()}
                  <div className="flex-1 p-8">
                    <div className="max-w-2xl">
                      <h2 className="text-2xl font-bold mb-4">Main Content Area</h2>
                      <p className="text-muted-foreground mb-4">
                        This represents your main application content. Notice how the sidebar expands on hover,
                        providing easy access to navigation while maximizing screen real estate when not in use.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">User Experience</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              The hover-expandable sidebar provides an intuitive navigation experience while preserving
                              valuable screen space for your content.
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Space Efficiency</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              When collapsed, the sidebar takes minimal space, allowing your main content to utilize the
                              full width of the screen.
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
