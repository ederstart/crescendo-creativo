import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Play, ArrowRight, FileText, Image, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: FileText,
      title: 'Roteiros',
      description: 'Escreva e organize seus roteiros com formatação rica e auto-save.',
    },
    {
      icon: Image,
      title: 'Mood Boards',
      description: 'Crie boards visuais estilo PureRef para suas referências.',
    },
    {
      icon: Link2,
      title: 'Thumbnails',
      description: 'Vincule thumbnails aos seus roteiros de forma visual.',
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px]" />
      </div>

      {/* Hero Section */}
      <div className="relative">
        <header className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-fire rounded-xl flex items-center justify-center shadow-glow">
                <Play className="w-5 h-5 text-primary-foreground fill-current" />
              </div>
              <span className="font-display font-bold text-xl text-foreground">
                CRESCER <span className="text-gradient-fire">YOUTUBE</span>
              </span>
            </div>
            <Button variant="fire" onClick={() => navigate('/auth')}>
              Começar
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-6 pt-20 pb-32">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6 animate-fade-in">
              Gerencie seu conteúdo{' '}
              <span className="text-gradient-fire">como um pro</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-fade-in">
              Roteiros, referências e thumbnails em um só lugar. 
              Organize sua produção do YouTube de forma profissional.
            </p>
            <div className="flex gap-4 justify-center animate-fade-in">
              <Button variant="fire" size="xl" onClick={() => navigate('/auth')}>
                Começar Agora
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="glass" size="xl" onClick={() => navigate('/auth')}>
                Fazer Login
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-32">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="glass rounded-2xl p-8 shadow-card hover:shadow-glow transition-all animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 gradient-fire rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="container mx-auto px-6 text-center">
            <p className="text-sm text-muted-foreground">
              © 2024 Crescer YouTube. Feito para criadores.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
