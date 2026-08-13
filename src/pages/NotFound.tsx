import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="text-center bg-card rounded-2xl shadow-lg border border-border/50 p-12">
        <h1 className="mb-4 text-5xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">Oops! Página não encontrada</p>
        <a href="/" className="text-primary font-medium hover:text-primary/80 transition-colors">
          Voltar ao início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
