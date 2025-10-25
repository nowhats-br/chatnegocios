import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
import Button from './Button';
import { Heart, Star, MessageCircle, Share2 } from 'lucide-react';

const CardDemo: React.FC = () => {
  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="typography-h1 mb-2">Enhanced Card Variants</h1>
        <p className="typography-body-lg typography-muted mb-8">
          Demonstrating the new card variants with hover effects and interactive states
        </p>

        {/* Default Cards */}
        <section className="mb-12">
          <h2 className="typography-h2 mb-6">Default Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Default Card</CardTitle>
                <CardDescription>
                  Basic card with subtle shadow and border
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  This is the default card variant with standard styling.
                </p>
              </CardContent>
            </Card>

            <Card hover>
              <CardHeader>
                <CardTitle>Default with Hover</CardTitle>
                <CardDescription>
                  Default card with hover effects enabled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  Hover over this card to see the subtle animation effects.
                </p>
              </CardContent>
            </Card>

            <Card interactive>
              <CardHeader>
                <CardTitle>Interactive Default</CardTitle>
                <CardDescription>
                  Default card with interactive feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  Click this card to see the active state feedback.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Elevated Cards */}
        <section className="mb-12">
          <h2 className="typography-h2 mb-6">Elevated Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Elevated Card</CardTitle>
                <CardDescription>
                  Card with enhanced shadow and no border
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  This elevated card creates depth with enhanced shadows.
                </p>
              </CardContent>
            </Card>

            <Card variant="elevated" hover>
              <CardHeader>
                <CardTitle>Elevated with Hover</CardTitle>
                <CardDescription>
                  Elevated card with prominent hover effects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  Hover to see the enhanced shadow and scale transform.
                </p>
              </CardContent>
            </Card>

            <Card variant="elevated" interactive>
              <CardHeader>
                <CardTitle>Interactive Elevated</CardTitle>
                <CardDescription>
                  Elevated card with full interactive feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  Click to experience the interactive feedback with scale animation.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Outlined Cards */}
        <section className="mb-12">
          <h2 className="typography-h2 mb-6">Outlined Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card variant="outlined">
              <CardHeader>
                <CardTitle>Outlined Card</CardTitle>
                <CardDescription>
                  Card with prominent border and no shadow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  This outlined card emphasizes the border design.
                </p>
              </CardContent>
            </Card>

            <Card variant="outlined" hover>
              <CardHeader>
                <CardTitle>Outlined with Hover</CardTitle>
                <CardDescription>
                  Outlined card with border color transitions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  Hover to see the border color change and subtle shadow.
                </p>
              </CardContent>
            </Card>

            <Card variant="outlined" interactive>
              <CardHeader>
                <CardTitle>Interactive Outlined</CardTitle>
                <CardDescription>
                  Outlined card with interactive border effects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  Click to see the border interaction and scale feedback.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Glass Morphism Cards */}
        <section className="mb-12">
          <h2 className="typography-h2 mb-6">Glass Morphism Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card variant="glass">
              <CardHeader>
                <CardTitle>Glass Card</CardTitle>
                <CardDescription>
                  Modern glass morphism effect with backdrop blur
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  This glass card uses backdrop blur for a modern look.
                </p>
              </CardContent>
            </Card>

            <Card variant="glass" hover>
              <CardHeader>
                <CardTitle>Glass with Hover</CardTitle>
                <CardDescription>
                  Glass card with enhanced blur on hover
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  Hover to see the enhanced backdrop blur effect.
                </p>
              </CardContent>
            </Card>

            <Card variant="glass" interactive>
              <CardHeader>
                <CardTitle>Interactive Glass</CardTitle>
                <CardDescription>
                  Glass card with full interactive experience
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body">
                  Click to experience the glass morphism interaction.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Real-world Examples */}
        <section className="mb-12">
          <h2 className="typography-h2 mb-6">Real-world Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Product Card */}
            <Card variant="elevated" interactive>
              <CardHeader>
                <CardTitle>Product Card</CardTitle>
                <CardDescription>
                  Interactive product showcase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg mb-4 flex items-center justify-center">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                    <Star className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <p className="typography-body-sm">
                  Premium product with excellent reviews and ratings.
                </p>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="typography-h4 text-primary">$99.99</span>
                <Button variant="gradient" size="sm">
                  Add to Cart
                </Button>
              </CardFooter>
            </Card>

            {/* Social Card */}
            <Card variant="glass" interactive>
              <CardHeader>
                <CardTitle>Social Post</CardTitle>
                <CardDescription>
                  Glass morphism social media card
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="typography-body mb-4">
                  "Just launched our new design system! The glass morphism cards look amazing 🚀"
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                    <Heart className="w-4 h-4" />
                    <span>24</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    <span>8</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-green-500 transition-colors">
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card variant="outlined" hover>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>
                  Performance metrics overview
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="typography-body-sm text-muted-foreground">Page Views</span>
                    <span className="typography-h4 text-success">+12.5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="typography-body-sm text-muted-foreground">Conversions</span>
                    <span className="typography-h4 text-primary">+8.2%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="typography-body-sm text-muted-foreground">Revenue</span>
                    <span className="typography-h4 text-warning">+15.7%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CardDemo;