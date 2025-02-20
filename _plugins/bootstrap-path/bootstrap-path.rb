module Jekyll
  class BootstrapSassPath < Generator
    safe true
    def generate(site)
      begin
        bootstrap_spec = Gem::Specification.find_by_name('bootstrap')
        bootstrap_sass_path = File.join(bootstrap_spec.gem_dir, 'assets', 'stylesheets')
        site.config['sass'] ||= {}
        site.config['sass']['load_paths'] ||= []
        site.config['sass']['load_paths'] << bootstrap_sass_path
      rescue Gem::LoadError
        Jekyll.logger.warn "Bootstrap gem nicht gefunden."
      end
    end
  end
end