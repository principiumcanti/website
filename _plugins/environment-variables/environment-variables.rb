module Jekyll
  class EnvironmentVariablesGenerator < Generator
    def generate(site)
      site.config['public-key'] = ENV['PUBLIC_KEY']
      # Add other environment variables to `site.config` here...
    end
  end
end